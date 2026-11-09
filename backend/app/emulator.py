"""Thin boto3 layer over the local AWS emulator (Floci on :4566)."""

import io
import json
import time
import uuid
import zipfile
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import settings

_IGNORED = {
    "s3": {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"},
    "dynamodb": {"ResourceInUseException"},
    "lambda": {"ResourceConflictException"},
}

# process-local stats: the emulator does not expose invocation metrics directly
LAST_STATS = {"invocations": 0, "last_duration_ms": None}


@lru_cache(maxsize=None)
def client(service: str):
    return boto3.client(
        service,
        endpoint_url=settings.floci_endpoint,
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(
            connect_timeout=3,
            # Lambda pulls its runtime image on the first invoke, so allow a cold start
            read_timeout=180 if service == "lambda" else 10,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def _ignore(exc: ClientError, service: str) -> bool:
    return exc.response.get("Error", {}).get("Code") in _IGNORED.get(service, set())


def _lambda_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "index.py",
            "def handler(event, context):\n"
            "    return {'ok': True, 'received': event}\n",
        )
    return buffer.getvalue()


def ensure_resources() -> None:
    """Idempotently create the five demo resources."""
    sqs = client("sqs")
    queue_url = sqs.create_queue(QueueName=settings.sqs_queue)["QueueUrl"]
    queue_arn = sqs.get_queue_attributes(
        QueueUrl=queue_url, AttributeNames=["QueueArn"]
    )["Attributes"]["QueueArn"]

    s3 = client("s3")
    try:
        s3.create_bucket(Bucket=settings.s3_bucket)
    except ClientError as exc:
        if not _ignore(exc, "s3"):
            raise

    sns = client("sns")
    topic_arn = sns.create_topic(Name=settings.sns_topic)["TopicArn"]
    existing = sns.list_subscriptions_by_topic(TopicArn=topic_arn)["Subscriptions"]
    if not any(sub["Endpoint"] == queue_arn for sub in existing):
        sns.subscribe(TopicArn=topic_arn, Protocol="sqs", Endpoint=queue_arn)

    dynamodb = client("dynamodb")
    try:
        dynamodb.describe_table(TableName=settings.dynamodb_table)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        dynamodb.create_table(
            TableName=settings.dynamodb_table,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

    lam = client("lambda")
    try:
        lam.create_function(
            FunctionName=settings.lambda_function,
            Runtime="python3.12",
            Role="arn:aws:iam::000000000000:role/cendekiawan-lambda",
            Handler="index.handler",
            Code={"ZipFile": _lambda_zip()},
            Timeout=10,
        )
    except ClientError as exc:
        if not _ignore(exc, "lambda"):
            raise


def ping() -> None:
    client("sqs").list_queues()


def _sqs_state() -> dict:
    sqs = client("sqs")
    queue_url = sqs.get_queue_url(QueueName=settings.sqs_queue)["QueueUrl"]
    attrs = sqs.get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=[
            "ApproximateNumberOfMessages",
            "ApproximateNumberOfMessagesNotVisible",
        ],
    )["Attributes"]
    return {
        "status": "ok",
        "queue": settings.sqs_queue,
        "depth": int(attrs["ApproximateNumberOfMessages"]),
        "in_flight": int(attrs["ApproximateNumberOfMessagesNotVisible"]),
    }


def _s3_state() -> dict:
    s3 = client("s3")
    count = 0
    total_bytes = 0
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=settings.s3_bucket):
        for obj in page.get("Contents", []):
            count += 1
            total_bytes += obj["Size"]
    return {
        "status": "ok",
        "bucket": settings.s3_bucket,
        "objects": count,
        "bytes": total_bytes,
    }


def _sns_state() -> dict:
    sns = client("sns")
    topics = sns.list_topics()["Topics"]
    topic_arn = next(
        (t["TopicArn"] for t in topics if t["TopicArn"].endswith(f":{settings.sns_topic}")),
        None,
    )
    subscriptions = (
        sns.list_subscriptions_by_topic(TopicArn=topic_arn)["Subscriptions"]
        if topic_arn
        else []
    )
    return {
        "status": "ok",
        "topic": settings.sns_topic,
        "subscriptions": len(subscriptions),
        "fanout": [sub["Endpoint"].rsplit(":", 1)[-1] for sub in subscriptions],
    }


def _dynamodb_state() -> dict:
    dynamodb = client("dynamodb")
    result = dynamodb.scan(TableName=settings.dynamodb_table, Select="COUNT")
    return {
        "status": "ok",
        "table": settings.dynamodb_table,
        "items": int(result.get("Count", 0)),
    }


def _lambda_state() -> dict:
    return {
        "status": "ok",
        "function": settings.lambda_function,
        "invocations": LAST_STATS["invocations"],
        "last_duration_ms": LAST_STATS["last_duration_ms"],
    }


def snapshot() -> dict:
    """Live state per service; a broken service reports 'down' instead of failing."""
    result = {}
    for name, probe in (
        ("sqs", _sqs_state),
        ("s3", _s3_state),
        ("sns", _sns_state),
        ("dynamodb", _dynamodb_state),
        ("lambda", _lambda_state),
    ):
        try:
            result[name] = probe()
        except Exception as exc:  # noqa: BLE001 - one bad service must not blank the UI
            result[name] = {"status": "down", "error": exc.__class__.__name__}
    return result


def send_messages(count: int) -> dict:
    sqs = client("sqs")
    queue_url = sqs.get_queue_url(QueueName=settings.sqs_queue)["QueueUrl"]
    sent = 0
    for start in range(0, count, 10):
        chunk = min(10, count - start)
        entries = [
            {
                "Id": str(i),
                "MessageBody": json.dumps({"seq": start + i, "ts": time.time()}),
            }
            for i in range(chunk)
        ]
        response = sqs.send_message_batch(QueueUrl=queue_url, Entries=entries)
        sent += len(response.get("Successful", []))
    return {"sent": sent}


def publish(count: int) -> dict:
    sns = client("sns")
    topic_arn = next(
        t["TopicArn"]
        for t in sns.list_topics()["Topics"]
        if t["TopicArn"].endswith(f":{settings.sns_topic}")
    )
    for i in range(count):
        sns.publish(
            TopicArn=topic_arn,
            Message=json.dumps({"seq": i, "ts": time.time()}),
        )
    return {"published": count}


def upload(count: int) -> dict:
    s3 = client("s3")
    keys = []
    for _ in range(count):
        key = f"sample-{uuid.uuid4().hex[:12]}.txt"
        s3.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=b"cendekiawan sample object\n",
            ContentType="text/plain",
        )
        keys.append(key)
    return {"uploaded": len(keys), "keys": keys}


def write_item(count: int) -> dict:
    dynamodb = client("dynamodb")
    ids = []
    for _ in range(count):
        item_id = uuid.uuid4().hex[:12]
        dynamodb.put_item(
            TableName=settings.dynamodb_table,
            Item={
                "id": {"S": item_id},
                "created_at": {"N": str(int(time.time()))},
                "source": {"S": "cendekiawan"},
            },
        )
        ids.append(item_id)
    return {"written": len(ids), "ids": ids}


def invoke() -> dict:
    lam = client("lambda")
    started = time.perf_counter()
    response = lam.invoke(
        FunctionName=settings.lambda_function,
        Payload=json.dumps({"source": "cendekiawan"}).encode(),
    )
    duration_ms = round((time.perf_counter() - started) * 1000, 1)
    payload = response.get("Payload")
    body = payload.read().decode() if payload else ""
    LAST_STATS["invocations"] += 1
    LAST_STATS["last_duration_ms"] = duration_ms
    return {
        "status_code": response.get("StatusCode", 200),
        "duration_ms": duration_ms,
        "payload": body,
    }


def oldest_message_age() -> float | None:
    """CloudWatch-only metric; SQS publishes it once per minute."""
    cloudwatch = client("cloudwatch")
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    response = cloudwatch.get_metric_statistics(
        Namespace="AWS/SQS",
        MetricName="ApproximateAgeOfOldestMessage",
        Dimensions=[{"Name": "QueueName", "Value": settings.sqs_queue}],
        StartTime=now - timedelta(minutes=10),
        EndTime=now,
        Period=60,
        Statistics=["Maximum"],
    )
    points = response.get("Datapoints", [])
    if not points:
        return None
    return float(max(points, key=lambda point: point["Timestamp"])["Maximum"])
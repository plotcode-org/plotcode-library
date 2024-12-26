import pulumi
import pulumi_aws as aws

#stack inputs
adobe_partner_event_bus = pulumi.Config().require("adobeEventBusName")

# Turn partner event bus from string to EventBus object
partner_event_bus = aws.cloudwatch.EventBus(adobe_partner_event_bus)

# CloudWatch Logs Group that stores all events sent by Adobe for debugging or archive
log_group = aws.cloudwatch.LogGroup(
    "Adobe-all-events",
    retention_in_days=1,
    tags={
        "Name": "Adobe-all-events"
    }
)

# CloudWatch Logs Group that stores specific events from Adobe for debugging or archive
log_group_order_events = aws.cloudwatch.LogGroup(
    "Adobe-specific-events",
    retention_in_days=1,
    tags={
        "Name": "Adobe-specific-events"
    }
)

lambda_role = aws.iam.Role(
    "adobe-cdk-lambda-role",
    assume_role_policy="""{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": "sts:AssumeRole",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Effect": "Allow",
                "Sid": ""
            }
        ]
    }"""
)

lambda_role_policy = aws.iam.RolePolicyAttachment(
    "lambdaBasicExecutionRole",
    role=lambda_role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
)

# A Lambda function to consume and process specific events
adobe_process_order_events_lambda = aws.lambda_.Function(
    "AdobeProcessOrderEventsLambda",
    runtime="python3.11",
    code=pulumi.AssetArchive({
        ".": pulumi.FileArchive("src")
    }),
    handler="AdobeProcessOrderEvents.handler",
    role=lambda_role.arn,
    timeout=15
)

# EventBridge Adobe all events rule
adobe_all_events_rule = aws.cloudwatch.EventRule(
    "AdobeAllEventsRule",
    event_bus_name=partner_event_bus.name,
    event_pattern="""{
        "source": ["aws.partner/developer.adobe.com.test"]
    }"""
)

# CloudWatch Log Group as target for EventBridge Rule
adobe_all_events_target = aws.cloudwatch.EventTarget(
    "AdobeAllEventsTarget",
    rule=adobe_all_events_rule.name,
    arn=log_group.arn
)

# EventBridge Adobe photoshop job status events
adobe_order_events_rule = aws.cloudwatch.EventRule(
    "AdobeSpecificEventsRule",
    event_bus_name=partner_event_bus.name,
    event_pattern="""{
        "source": ["aws.partner/developer.adobe.com.test"],
        "detail-type": ["Imaging API Events:photoshop-job-status"],
        "detail": {
            "key": ["value"]
        }
    }"""
)

# Lambda as target for EventBridge Rule
adobe_order_events_lambda_target = aws.cloudwatch.EventTarget(
    "AdobeOrderEventsLambdaTarget",
    rule=adobe_order_events_rule.name,
    arn=adobe_process_order_events_lambda.arn
)

# CloudWatch Log Group as target for EventBridge Rule
adobe_order_events_log_target = aws.cloudwatch.EventTarget(
    "AdobeOrderEventsLogTarget",
    rule=adobe_order_events_rule.name,
    arn=log_group_order_events.arn
)

# Print the Lambda function name
pulumi.export("AdobeProcessSpecificEventsLambdaOutput", adobe_process_order_events_lambda.name)


#!/bin/bash

# Check if region parameter is passed
if [ -n "$AWS_DEFAULT_REGION" ]; then
  echo "AWS_DEFAULT_REGION is set, using $AWS_DEFAULT_REGION for the AWS region"
  REGION=$AWS_DEFAULT_REGION
else
  REGION=$(aws configure get region)
  echo "AWS_DEFAULT_REGION is not set, use $REGION for the aws region"
fi

# Get account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Bucket name
BUCKET="eval-$ACCOUNT_ID-$REGION"

# Check if bucket exists
if ! aws s3api head-bucket --bucket $BUCKET --region $REGION 1>/dev/null 2>/dev/null; then
  # Bucket does not exist, create it
  echo "Creating bucket $BUCKET..."
  aws s3 mb s3://$BUCKET --region $REGION
else
  echo "Bucket $BUCKET already exists, using the bucket"
fi

 cd custom_resource

 # Install the required packages into a directory named 'package'
 pip install -r requirements.txt -t package

 # Navigate to the package directory
 cd package

# Copy the lambda_handler.py into the package directory
 cp ../lambda_function.py .

# Zip the contents of the package directory into a file named lambda_function.zip
 zip -r ../lambda_function.zip .

# Navigate back to the custom_resource directory
cd ..

## Clean up by removing the package directory
rm -rf package


echo "Lambda function package created: custom_resource/lambda_function.zip"

# copy to s3 as package
aws s3 cp lambda_function.zip s3://$BUCKET/custom_resource/lambda_function.zip

# delete the local zip file
rm lambda_function.zip

cd ..

# create the llmmeter sample code package
cd llmetersample

# Install the required packages into a directory named 'package'
pip install -r requirements.txt -t package

# Navigate to the package directory
cd package

# Copy the lambda_handler.py into the package directory
cp ../lambda_function.py .

# Zip the contents of the package directory into a file named lambda_function.zip
zip -r ../lambda_function.zip .

# Navigate back to the llmetersample directory
cd ..

## Clean up by removing the package directory
rm -rf package

echo "Lambda function package created: llmetersample/lambda_function.zip"

# copy to s3 as package
aws s3 cp lambda_function.zip s3://$BUCKET/llmetersample/lambda_function.zip

rm lambda_function.zip

cd ..

# Export bucket name as environment variable
export EVAL_PIPELINE_BUCKET=$BUCKET


zip_file_name="lambda_extra_package.zip"
# if the file exists, skip the zip command
if [ -f "$zip_file_name" ]; then
    echo "$zip_file_name already exists, skipping the zip command"
else
    mkdir packages
    pip install --platform manylinux2014_x86_64 --target ./packages -r requirements_lambda.txt --only-binary=:all:
    cd packages
    zip -r ../$zip_file_name .
    cd ..
    rm -rf packages
fi

# upload the zip file to s3
echo "uploading lambda extra package to s3..."
aws s3 cp $zip_file_name s3://$BUCKET/$zip_file_name --region $REGION

rm -rf $zip_file_name

# create a lambda package
echo "creating lambda package..."


# sam build
echo "sam build..."
sam build

# sam package
echo "sam package..."
sam package --s3-bucket $BUCKET --output-template-file packaged.yaml --region $REGION

# sam deploy
echo "sam deploy..."
sam deploy --template-file packaged.yaml --stack-name llm-evaluation-stack --capabilities CAPABILITY_NAMED_IAM --parameter-overrides TrainingURL=763104351884.dkr.ecr.$REGION.amazonaws.com/pytorch-training:2.1.0-cpu-py310 --region $REGION

# get the cloudformation output values KnowledgeBaseWithAoss and KnowledgeBaseDataSource
echo "getting the cloudformation output values..."
KNOWLEDGE_BASE_WITH_AOSS=$(aws cloudformation describe-stacks --stack-name llm-evaluation-stack --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseWithAoss`].OutputValue' --output text --region $REGION)
echo "KnowledgeBaseWithAoss: $KNOWLEDGE_BASE_WITH_AOSS"
KNOWLEDGE_BASE_DATA_SOURCE=$(aws cloudformation describe-stacks --stack-name llm-evaluation-stack --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseDataSource`].OutputValue' --output text --region $REGION)
echo "KnowledgeBaseDataSource: $KNOWLEDGE_BASE_DATA_SOURCE"

# Get the approximate number of items in the table
ITEM_COUNT=$(aws dynamodb describe-table --table-name SolutionTableDDB | jq .Table.ItemCount)

# Check if table is empty
if [ "$ITEM_COUNT" -eq "0" ]; then
  echo "Table SolutionTableDDB is empty... ingesting data"
  aws dynamodb batch-write-item --request-items file://data.json
else
  echo "Table SolutionTableDDB already contains $ITEM_COUNT items"
fi

ITEM_COUNT=$(aws dynamodb describe-table --table-name SolutionTableDDB | jq .Table.ItemCount)

# Check if table is empty
if [ "$ITEM_COUNT" -eq "0" ]; then
  echo "Table SolutionTableDDB is empty... ingesting data"
  aws dynamodb batch-write-item --request-items file://solutionddb-data.json
else
  echo "Table SolutionTableDDB already contains $ITEM_COUNT items"
fi


# put the sample document to knowledge base
echo "putting sample document to knowledge base..."
aws s3 cp ../evaluation_artifacts/Amazon_SageMaker_Developer_Guide.pdf s3://bedrock-kb-$ACCOUNT_ID-$REGION/knowledgesource/

echo "sync the data via data source sync"
aws bedrock-agent start-ingestion-job --knowledge-base-id $KNOWLEDGE_BASE_WITH_AOSS --data-source-id $KNOWLEDGE_BASE_DATA_SOURCE --region $REGION
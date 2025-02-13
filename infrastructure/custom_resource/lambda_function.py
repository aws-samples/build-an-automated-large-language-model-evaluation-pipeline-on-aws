import os
import boto3
import time
import logging
from requests_aws4auth import AWS4Auth
import requests
from requests.exceptions import RequestException
import cfnresponse

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants
REQUIRED_ENV_VARS = ['OPENSEARCH_HOSTNAME', 'OPENSEARCH_INDEX_NAME', 'EMBEDDING_MODEL']
DEFAULT_HEADERS = {"Content-Type": "application/json"}
KNN_SETTINGS = {
    "ef_search": 512,
    "m": 16,
    "ef_construction": 512
}

# Environment variables
hostname = os.environ['OPENSEARCH_HOSTNAME']
index_name = os.environ['OPENSEARCH_INDEX_NAME']
embedding_model = os.environ['EMBEDDING_MODEL']
# If you are going to increase the index wait for ready value, make sure to adjust the lambda timeout value accordingly
index_wait_for_ready = os.environ.get('INDEX_WAIT_FOR_READY', 30)

# Model dimensions mapping
embedding_context_dimensions = {
    "cohere.embed-multilingual-v3": 512,
    "cohere.embed-english-v3": 512,
    "amazon.titan-embed-text-v1": 1536,
    "amazon.titan-embed-text-v2:0": 1024
}

def validate_environment_variables():
    """Validate that all required environment variables are present"""
    missing_vars = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def get_index_document(embedding_dimension):
    """Generate the index document configuration"""
    return {
        "settings": {
            "index": {
                "knn": "true",
                "knn.algo_param.ef_search": KNN_SETTINGS["ef_search"]
            }
        },
        "mappings": {
            "properties": {
                "index": {
                    "type": "knn_vector",
                    "dimension": embedding_dimension,
                    "method": {
                        "name": "hnsw",
                        "engine": "faiss",
                        "parameters": {
                            "m": KNN_SETTINGS["m"],
                            "ef_construction": KNN_SETTINGS["ef_construction"]
                        },
                        "space_type": "l2"
                    }
                }
            }
        }
    }

def create_index(url, auth, document, headers, max_retries=5, initial_delay=1):
    """
    Create index with exponential backoff retry logic
    """
    for attempt in range(max_retries):
        try:
            # Create the index
            response = requests.put(url, auth=auth, json=document, headers=headers)
            
            if response.status_code == 503:
                delay = initial_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(f"Received 503 error, attempt {attempt + 1}/{max_retries}. "
                             f"Retrying in {delay} seconds...")
                time.sleep(delay)
                continue
                
            response.raise_for_status()
            logger.info(f"Index creation initiated with status code: {response.status_code}")
            
            # Wait for index to be ready - it can take a few seconds for the index to be ready
            # If you know of a reliable and programmatic way to check for index to be ready, please raise a PR
            time.sleep(index_wait_for_ready)            
            
            return response
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to create index after {max_retries} attempts: {str(e)}")
                raise
            
            delay = initial_delay * (2 ** attempt)
            logger.warning(f"Request failed, attempt {attempt + 1}/{max_retries}. "
                         f"Retrying in {delay} seconds... Error: {str(e)}")
            time.sleep(delay)

    raise Exception(f"Failed to create index after {max_retries} attempts")


def lambda_handler(event, context):
    """
    Main Lambda handler function
    """
    response_data = {}
    
    try:
        # Validate environment variables
        validate_environment_variables()
        
        request_type = event['RequestType']
        region = context.invoked_function_arn.split(":")[3]
        host = f'https://{hostname}.{region}.aoss.amazonaws.com'
        url = f"{host}/{index_name}"
        
        # Setup AWS authentication
        service = 'aoss'
        credentials = boto3.Session().get_credentials()
        awsauth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            region,
            service,
            session_token=credentials.token
        )

        if request_type == 'Create':
            try:
                # Get the document configuration
                embedding_dimension = embedding_context_dimensions.get(embedding_model)
                if not embedding_dimension:
                    raise ValueError(f"Unsupported embedding model: {embedding_model}")
                
                document = get_index_document(embedding_dimension)
                
                # Create and wait for index
                create_index(url, awsauth, document, DEFAULT_HEADERS)
                logger.info("Index creation completed successfully")
                response_data['Message'] = 'Index created and ready'
                cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
                
            except TimeoutError as te:
                logger.error(f"Index creation timed out: {str(te)}")
                response_data['Data'] = str(te)
                cfnresponse.send(event, context, cfnresponse.FAILED, response_data)
                
            except Exception as e:
                logger.error(f"Error during index creation: {str(e)}")
                response_data['Data'] = str(e)
                cfnresponse.send(event, context, cfnresponse.FAILED, response_data)
                
        elif request_type == 'Delete':
            try:
                # Optionally add index deletion logic here
                logger.info(f"Processing delete request for index: {index_name}")
                cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
                
            except Exception as e:
                logger.error(f"Error during index deletion: {str(e)}")
                response_data['Data'] = str(e)
                cfnresponse.send(event, context, cfnresponse.FAILED, response_data)
                
        else:
            logger.warning(f"Unsupported request type: {request_type}")
            response_data['Message'] = f"Unsupported request type: {request_type}"
            cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
            
    except Exception as e:
        logger.error(f"Execution failed: {str(e)}")
        response_data['Data'] = str(e)
        cfnresponse.send(event, context, cfnresponse.FAILED, response_data)

import os
import boto3
from requests_aws4auth import AWS4Auth
import requests
import cfnresponse
import time

hostname = os.environ['OPENSEARCH_HOSTNAME']
index_name = os.environ['OPENSEARCH_INDEX_NAME']
embedding_model = os.environ['EMBEDDING_MODEL']

embedding_context_dimensions = {
    "cohere.embed-multilingual-v3": 512,
    "cohere.embed-english-v3": 512,
    "amazon.titan-embed-text-v1": 1536,
    "amazon.titan-embed-text-v2:0": 1024
}

def lambda_handler(event, context):
    request_type = event['RequestType']
    # props = event['ResourceProperties']
    response_data = {}
    region = context.invoked_function_arn.split(":")[3]
    host = f'https://{hostname}.{region}.aoss.amazonaws.com'
    url = host + '/' + index_name
    service = 'aoss'
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, service, session_token=credentials.token)
    headers = { "Content-Type": "application/json" }
    document = {
          "settings": {
            "index": {
              "knn": "true",
              "knn.algo_param.ef_search": 512
            }
          },
          "mappings": {
            "properties": {
              "index": {
                "type": "knn_vector",
                "dimension": embedding_context_dimensions[embedding_model],
                "method": {
                  "name": "hnsw",
                  "engine": "faiss",
                  "parameters": {
                    "m": 16,
                    "ef_construction": 512
                  },
                  "space_type": "l2"
                }
              }
            }
          }
        }
    try:
        if request_type == 'Create':
            response = requests.put(url, auth=awsauth, json=document, headers=headers)
            print(response.raise_for_status())
            if response.status_code == 200:
                time.sleep(30)
                cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
        elif request_type == 'Delete':
            cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
    except Exception as e:
        print("Execution failed...")
        print(str(e))
        response_data['Data'] = str(e)
        cfnresponse.send(event, context, cfnresponse.FAILED, response_data)
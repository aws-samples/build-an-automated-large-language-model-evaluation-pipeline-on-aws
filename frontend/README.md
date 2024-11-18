## Simple React frontend for GenAI eval framework

This is a simple React app designed to be used with (AWS gen AI evaluation pipeline)[https://github.com/aws-samples/build-an-automated-large-langurage-model-evaluation-pipeline-on-aws]

### Prerequisites

1. Make sure Docker is installed and running
2. For local deployments, make sure aws credentials are available in `~/.aws/credentials`
3. For cloud deployment, we will use aws [copilot-cli](https://github.com/aws/copilot-cli/) to deploy the app in Fargate. Copilot CLI is a tool for developers to build, release and operate production-ready containerized applications on AWS App Runner or Amazon ECS on AWS Fargate. Install aws [copilot-cli](https://github.com/aws/copilot-cli/) using `brew install aws/tap/copilot-cli` using homebrew. For other installation options, check the copilot-cli github repo.
4. Copy the `.env-example` file to `.env` file in the project root directory. Replace the value of `REACT_APP_BACKEND_API_HOST` with the URL of the backend evaluation API

### Running the app locally

To run the app locally, run the following command:

`run.sh local`

This will run a docker container with all the dependencies. You should be able to access the app at `localhost:3000`

### Running the app in AWS Fargate

To deploy the app in Fargate, run the following command:

`run.sh deploy`

This will deploy the app in Fargate. The deployment might take 5-10 minutes. Once deployment is finished, a URL will be printed in the terminal. This URL can be used to access the app.

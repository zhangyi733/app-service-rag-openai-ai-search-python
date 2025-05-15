# FastAPI AI Search with Azure OpenAI and Azure AI Search on Azure App Service

This project demonstrates retrieval augmented generation (RAG) using FastAPI, Azure OpenAI, and Azure AI Search, deployed to Azure App Service, and secured with passwordless authentication through managed identities. It's a functionally equivalent implementation of the Spring Boot and .NET Blazor RAG applications.

## Features

- **FastAPI** web application with a chat interface using Jinja2 templates.
- **RAG implementation** using Azure App Service, Azure OpenAI, and Azure AI Search.
- **Hybrid search** combining vector search, keyword matching, and semantic ranking.
- **Citation display** showing the sources of information in responses.
- **Enterprise-ready security** with managed identities and RBAC role assignments.
- **Zero trust configuration** supporting Azure OpenAI on Your Data best practices.

## Hybrid Search Implementation

This application leverages Azure AI Search's hybrid search capabilities to provide more relevant and accurate results:

- **Vector search**: Uses embedding models to convert text into vector representations, enabling similarity search based on meaning rather than keywords.
   
- **Keyword matching**: Traditional keyword-based search to capture exact matches and specific terms.
   
- **Semantic ranking**: Advanced AI-powered re-ranking that improves search relevance by understanding the semantic meaning of queries and documents.

The combination of these approaches ensures the most relevant information is retrieved before being passed to the Azure OpenAI service for generating responses, providing more accurate, contextually aware answers with proper citations.

## Azure Resources

The application requires the following Azure resources:

- **Azure App Service**: Hosts the FastAPI web application.
- **Azure OpenAI**: Provides GPT model for chat completions and embedding model for vectorization.
- **Azure AI Search**: Provides vector search and semantic ranking capabilities.
- **Azure Storage Account**: Stores documents and document chunks.

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and update with your Azure resource details
3. Install dependencies: `pip install -r requirements.txt`
4. Start the application: `uvicorn main:app --reload`

### Local Development

To run the application locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Run with hot reloading
uvicorn main:app --reload
```

Then navigate to `http://localhost:8000` in your browser.

### Environment Variables

The following environment variables need to be set in the App Service configuration:

- `AZURE_OPENAI_ENDPOINT`: The endpoint URL for your Azure OpenAI resource
- `AZURE_OPENAI_GPT_DEPLOYMENT`: The deployment name for your GPT model
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`: The deployment name for your embedding model
- `AZURE_SEARCH_SERVICE_URL`: The URL for your Azure AI Search service
- `AZURE_SEARCH_INDEX_NAME`: The name of your search index

## Role Assignments

The following RBAC role assignments are needed to enable secure service-to-service communication:

| Role Assignment | Assignee | Target Resource | Purpose |
|-----------------|----------|----------------|---------|
| Cognitive Services OpenAI User | App Service | Azure OpenAI | Allows the web application to call the Azure OpenAI service for chat completions. |
| Search Index Data Reader | Azure OpenAI | Azure AI Search | Enables the OpenAI service to query data from the search index during inference. |
| Search Service Contributor | Azure OpenAI | Azure AI Search | Allows the OpenAI service to query the index schema for auto fields mapping. |
| Storage Blob Data Contributor | Azure OpenAI | Storage Account | Allows OpenAI to read from the input container and write preprocessed results. |
| Cognitive Services OpenAI Contributor | Azure AI Search | Azure OpenAI | Enables the Azure AI Search service to access Azure OpenAI's embedding endpoint. |
| Storage Blob Data Reader | Azure AI Search | Storage Account | Allows Azure AI Search to read document blobs and chunk blobs. |

## Deployment with GitHub Actions

This project can be deployed using GitHub Actions. A sample workflow is included to automate the build and deployment process.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

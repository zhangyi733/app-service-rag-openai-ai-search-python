"""
FastAPI RAG application using Azure OpenAI and Azure AI Search

This sample app demonstrates how to build a RAG (Retrieval Augmented Generation) application
that combines the power of Azure OpenAI with Azure AI Search to create an AI assistant
that answers questions based on your own data.

Key components:
1. FastAPI web framework for the backend API
2. Azure OpenAI for AI chat completions
3. Azure AI Search for document retrieval
4. Pydantic for configuration and data validation
5. Bootstrap and JavaScript for the frontend UI
"""
import os
import logging
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from app.models.chat_models import ChatRequest

# Feedback model and blob storage helper
from app.models.feedback_models import FeedbackRequest
from app.services.feedback_blob_storage import FeedbackBlobStorage
from app.services.evaluation_blob_storage import EvaluationBlobStorage
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Import the RAG chat service after logging to capture any initialization logs
from app.services.rag_chat_service import rag_chat_service

# Create FastAPI app
app = FastAPI(
    title="FastAPI RAG with Azure OpenAI and Azure AI Search",
    description="A FastAPI application that demonstrates retrieval augmented generation using Azure OpenAI and Azure AI Search.",
    version="1.0.0",
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up template directory
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """
    Serve the main chat interface
    """
    return templates.TemplateResponse("index.html", {"request": request})



@app.post("/api/chat/completion")
async def chat_completion(chat_request: ChatRequest):
    """
    Process a chat completion request with RAG capabilities and log evaluation data
    """
    import uuid
    import time
    from app.services.evaluation_blob_storage import EvaluationBlobStorage
    try:
        if not chat_request.messages:
            raise HTTPException(status_code=400, detail="Messages cannot be empty")

        # Generate a response_id for this LLM response
        response_id = str(uuid.uuid4())
        start_time = time.time()

        # 1. Get chat completion from RAG service
        response = await rag_chat_service.get_chat_completion(chat_request.messages)

        # 2. Extract intent from LLM response (assume intent is provided in a special field or pattern)
        detected_intent = ""
        try:
            # If the LLM response includes a structured intent, extract it
            # Example: intent is returned as part of the message context or as a prefix in the content
            choice = response.choices[0] if hasattr(response, 'choices') and response.choices else response['choices'][0]
            if choice and hasattr(choice.message, 'context') and choice.message.context and "intent" in choice.message.context:
                detected_intent = choice.message.context["intent"]
            elif llm_response and llm_response.lower().startswith("intent:"):
                # e.g., "Intent: book_flight\n..."
                detected_intent = llm_response.split('\n', 1)[0].replace("Intent:", "").strip()
            else:
                detected_intent = ""
        except Exception:
            detected_intent = ""

        # 3. Get AI search results (simulate by extracting from response if available)
        ai_search_results = None
        try:
            # If citations are present, use them as search results
            choice = response.choices[0] if hasattr(response, 'choices') and response.choices else response['choices'][0]
            ai_search_results = choice.message.context["citations"] if hasattr(choice.message, 'context') and choice.message.context and "citations" in choice.message.context else []
        except Exception:
            ai_search_results = []

        # 4. Final LLM response
        llm_response = None
        try:
            llm_response = choice.message.content if choice and hasattr(choice.message, 'content') else choice['message']['content']
        except Exception:
            llm_response = ""

        # 5. Save evaluation data
        eval_blob = EvaluationBlobStorage(
            account_url=settings.azure_blob_account_url,
            container_name=settings.azure_blob_container,
            blob_name=getattr(settings, 'azure_evaluation_blob', 'evaluation.jsonl')
        )

        eval_data = {
            "response_id": response_id,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "user_chat_history": [m.dict() for m in chat_request.messages],
            "detected_intent": detected_intent,
            "ai_search_results": ai_search_results,
            "llm_response": llm_response,
            "response_time_ms": int((time.time() - start_time) * 1000),
            # feedback and grounded_answer can be added later if user provides feedback
        }
        eval_blob.append_evaluation(eval_data)

        # Attach response_id to the API response for the frontend to use in feedback
        if isinstance(response, dict):
            response["response_id"] = response_id
        elif hasattr(response, "__dict__"):
            response.response_id = response_id

        return response

    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"Error in chat completion: {str(e)}")
        if "rate limit" in error_str or "capacity" in error_str or "quota" in error_str:
            return {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "The AI service is currently experiencing high demand. Please wait a moment and try again."
                    }
                }]
            }
        else:
            return {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": f"An error occurred: {str(e)}"
                    }
                }]
            }


@app.get("/api/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "ok"}


if __name__ == "__main__":
    # This lets you test the application locally with Uvicorn
    # For production deployment, use a proper ASGI server like Gunicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


# Feedback endpoint

@app.post("/api/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """
    Receive user feedback and append to Azure Blob Storage as JSONL.
    Also append feedback and grounded_answer to the last evaluation record in evaluation.jsonl.
    """
    try:
        # Prepare feedback blob storage helper (MSI)
        blob = FeedbackBlobStorage(
            account_url=settings.azure_blob_account_url,
            container_name=settings.azure_blob_container,
            blob_name=settings.azure_blob_feedback_blob
        )
        # Convert feedback to dict (ensure timestamp is ISO string)
        feedback_dict = feedback.dict()
        feedback_dict["timestamp"] = feedback.timestamp.isoformat()
        blob.append_feedback(feedback_dict)

        # Also update the correct evaluation record in evaluation.jsonl by matching response_id
        from app.services.evaluation_blob_storage import EvaluationBlobStorage
        eval_blob = EvaluationBlobStorage(
            account_url=settings.azure_blob_account_url,
            container_name=settings.azure_blob_container,
            blob_name=getattr(settings, 'azure_evaluation_blob', 'evaluation.jsonl')
        )
        # Download, update matching record, and re-upload
        try:
            eval_blob_client = eval_blob.container_client.get_blob_client(eval_blob.blob_name)
            existing = eval_blob_client.download_blob().readall().decode('utf-8')
            lines = existing.strip().split('\n') if existing else []
            if lines:
                import json
                updated_any = False
                for i, line in enumerate(lines):
                    try:
                        rec = json.loads(line)
                        if 'response_id' in rec and hasattr(feedback, 'response_id') and feedback.response_id == rec['response_id']:
                            rec["feedback"] = feedback.feedback
                            rec["feedback_timestamp"] = feedback.timestamp.isoformat()
                            # Edge case 1: Thumb up clears grounded_answer and failed_reason
                            if feedback.feedback == 'thumb_up':
                                rec["grounded_answer"] = ""
                                rec["failed_reason"] = ""
                            # Edge case 2: Thumb down overwrites grounded_answer and failed_reason
                            elif feedback.feedback == 'thumb_down':
                                rec["grounded_answer"] = feedback.grounded_answer if hasattr(feedback, 'grounded_answer') else ""
                                rec["failed_reason"] = feedback.failed_reason if hasattr(feedback, 'failed_reason') else ""
                            lines[i] = json.dumps(rec, default=str)
                            updated_any = True
                            break
                    except Exception as e:
                        logger.error(f"Error parsing evaluation record: {e}")
                if updated_any:
                    updated = '\n'.join(lines) + '\n'
                    eval_blob_client.upload_blob(updated, overwrite=True)
                else:
                    logger.warning("No matching evaluation record found for feedback.")
        except Exception as e:
            logger.error(f"Error updating evaluation.jsonl with feedback: {e}")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to save feedback")

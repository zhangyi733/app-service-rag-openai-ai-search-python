"""
Feedback model for storing user feedback on RAG responses
"""
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

class FeedbackRequest(BaseModel):
    response_id: str = Field(..., description="Unique response ID for the LLM response being rated")
    question: str = Field(..., description="User's question")
    answer: str = Field(..., description="App's answer")
    feedback: Literal['thumb_up', 'thumb_down'] = Field(..., description="User feedback: 'thumb_up' or 'thumb_down'")
    grounded_answer: Optional[str] = Field("", description="User-provided correct answer if original answer was incorrect")
    timestamp: datetime = Field(..., description="Timestamp of feedback (ISO format)")
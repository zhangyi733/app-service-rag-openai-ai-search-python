/**
 * Chat functionality for the RAG application.
 * 
 * This JavaScript handles the client-side functionality of the RAG application:
 * - Manages the chat UI (sending messages, displaying responses)
 * - Communicates with the FastAPI backend via fetch API
 * - Handles citations and displays them in a modal
 * - Manages error states and loading indicators
 * 
 * The chat interface supports:
 * 1. Free-form text input
 * 2. Quick-select question buttons
 * 3. Interactive citations from source documents
 * 4. Responsive design for various screen sizes
 */
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatHistory = document.getElementById('chat-history');
    const chatContainer = document.getElementById('chat-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    // Templates
    const emptyChatTemplate = document.getElementById('empty-chat-template');
    const userMessageTemplate = document.getElementById('user-message-template');
    const assistantMessageTemplate = document.getElementById('assistant-message-template');
    
    // Quick response buttons
    const btnPersonalInfo = document.getElementById('btn-personal-info');
    const btnWarranty = document.getElementById('btn-warranty');
    const btnCompany = document.getElementById('btn-company');
    
    // Chat history array
    let messages = [];
    
    // Initialize empty chat
    if (emptyChatTemplate) {
        const emptyContent = emptyChatTemplate.content.cloneNode(true);
        chatHistory.appendChild(emptyContent);
    }
    // Map of assistant message index to response_id
    let responseIds = [];
    
    // Event listeners
    chatForm.addEventListener('submit', handleChatSubmit);
    chatInput.addEventListener('keydown', handleKeyDown);
    btnPersonalInfo.addEventListener('click', () => sendQuickQuestion("What does Contoso do with my personal information?"));
    btnWarranty.addEventListener('click', () => sendQuickQuestion("How do I file a warranty claim?"));
    btnCompany.addEventListener('click', () => sendQuickQuestion("Tell me about your company."));
    
    /**
     * Handles form submission when the user sends a message
     */
    function handleChatSubmit(e) {
        e.preventDefault();
        const query = chatInput.value.trim();
        if (query && !isLoading()) {
            sendMessage(query);
        }
    }
    
    /**
     * Handles sending a message when Enter key is pressed
     */
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const query = chatInput.value.trim();
            if (query && !isLoading()) {
                sendMessage(query);
            }
        }
    }
    
    /**
     * Sends a predefined quick question when a suggestion button is clicked
     */
    function sendQuickQuestion(text) {
        if (!isLoading()) {
            chatInput.value = text;
            sendMessage(text);
        }
    }
    
    /**
     * Checks if a request is currently loading
     */
    function isLoading() {
        return !loadingIndicator.classList.contains('d-none');
    }
    
    /**
     * Displays a user message in the chat interface
     */
    function addUserMessage(text) {
        // Clear empty chat template if this is the first message
        if (chatHistory.querySelector('.text-center')) {
            chatHistory.innerHTML = '';
        }
        
        const messageNode = userMessageTemplate.content.cloneNode(true);
        const messageContent = messageNode.querySelector('.message-content');
        messageContent.innerHTML = text.replace(/\n/g, '<br>');
        chatHistory.appendChild(messageNode);
        scrollToBottom();
    }
    
    /**
     * Displays an assistant message with citations in the chat interface
     * 
     * This function:
     * 1. Creates the HTML for the assistant's message
     * 2. Processes any citations returned from Azure AI Search
     * 3. Converts citation references [doc1], [doc2], etc. into clickable badges
     * 4. Sets up event handlers for citation badge clicks
     * 5. Adds the message to the chat history
     */
    function addAssistantMessage(content, citations, responseId) {
        const messageNode = assistantMessageTemplate.content.cloneNode(true);
        const messageContent = messageNode.querySelector('.message-content');
        const messageDiv = messageNode.querySelector('.card');
        // Create a unique ID for this message
        const messageId = 'msg-' + Date.now();
        messageDiv.setAttribute('id', messageId);
        // Store response_id as a data attribute for this assistant message
        if (responseId) {
            messageDiv.setAttribute('data-response-id', responseId);
        }
        // Create a message-specific citation data store
        const messageCitations = {};
        if (content && content.length > 0) {
            // Format content with citations if available
            let formattedContent = content;
            // Render **bold** markdown (but not inside citation links)
            formattedContent = formattedContent.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
            // Render [docN] citations as clickable
            if (citations && citations.length > 0) {
                // Replace [doc1], [doc2], etc. with interactive citation links
                const pattern = /\[doc(\d+)\]/g;
                formattedContent = formattedContent.replace(pattern, (match, index) => {
                    const idx = parseInt(index);
                    if (idx > 0 && idx <= citations.length) {
                        const citation = citations[idx - 1];
                        const citationData = JSON.stringify({
                            title: citation.title || '',
                            content: citation.content || '',
                            filePath: citation.filePath || '',
                            url: citation.url || ''
                        });
                        // Store citation data in this message's citations
                        messageCitations[idx] = citationData;
                        // Create badge-style citation link
                        return `<a class=\"badge bg-primary rounded-pill\" style=\"cursor: pointer;\" data-message-id=\"${messageId}\" data-index=\"${idx}\">${idx}</a>`;
                    }
                    return match;
                });
            }
            // Render [filename.pdf] or [filename.docx] as clickable badge if not already a citation
            formattedContent = formattedContent.replace(/\[([^\[\]]+\.(pdf|docx|pptx|xlsx|txt|md|csv))\]/gi, (match, filename) => {
                // Avoid double rendering if already a docN citation
                if (/^doc\d+$/.test(filename)) return match;
                // Show as a badge, and on click show a modal with just the filename
                return `<a class=\"badge bg-secondary rounded-pill\" style=\"cursor: pointer;\" data-filename=\"${filename}\">${filename}</a>`;
            });
            messageContent.innerHTML = formattedContent.replace(/\n/g, '<br>');
            // Add click listeners for filename badges (non-citation)
            setTimeout(() => {
                const fileBadges = messageContent.querySelectorAll('.badge[data-filename]');
                fileBadges.forEach(badge => {
                    badge.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const filename = this.getAttribute('data-filename');
                        showCitationModal({ title: filename, content: '', filePath: filename, url: '' });
                    });
                });
            }, 100);
            // Store the message citations as a data attribute
            messageDiv.setAttribute('data-citations', JSON.stringify(messageCitations));
            // Add click listeners for citation badges
            setTimeout(() => {
                const badges = messageContent.querySelectorAll('.badge[data-index]');
                badges.forEach(badge => {
                    badge.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const messageId = this.getAttribute('data-message-id');
                        const idx = this.getAttribute('data-index');
                        // Get the message element
                        const messageElement = document.getElementById(messageId);
                        // Get this message's citations
                        const messageCitations = JSON.parse(messageElement.getAttribute('data-citations') || '{}');
                        const citationData = JSON.parse(messageCitations[idx]);
                        // Show citation modal
                        showCitationModal(citationData);
                    });
                });
            }, 100);
        }
        chatHistory.appendChild(messageNode);
        scrollToBottom();

        // Store response_id for this assistant message
        responseIds.push(responseId || null);

        // Store response_id for this assistant message
        responseIds.push(responseId || null);

        // Feedback button logic
        setTimeout(() => {
            const feedbackBtns = messageDiv.parentElement.querySelectorAll('.feedback-btn');
            const feedbackStatus = messageDiv.parentElement.querySelector('.feedback-status');
            let selectedFeedback = null;
            if (feedbackBtns) {
                feedbackBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        // Highlight the selected button and keep it highlighted
                        feedbackBtns.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        selectedFeedback = this;
                        // If thumb down, show modal for correct answer
                        if (btn.getAttribute('data-feedback') === 'thumb_down') {
                            showCorrectionModal((groundedAnswer) => {
                                submitFeedback(btn, groundedAnswer);
                            });
                        } else {
                            submitFeedback(btn, '');
                        }
                    });
                });
            }

            // Feedback submission logic
            function submitFeedback(btn, groundedAnswer) {
                // Disable buttons only during submission
                feedbackBtns.forEach(b => b.disabled = true);
                feedbackStatus.textContent = 'Sending...';
                // Find the last user message for this assistant reply
                let lastUserMsg = null;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                        lastUserMsg = messages[i].content;
                        break;
                    }
                }
            // Find the response_id for the assistant message being rated
            // Traverse up from the button to find the .card (assistant message div)
            let cardDiv = btn.closest('.card');
            let responseId = cardDiv ? cardDiv.getAttribute('data-response-id') : null;
            // Prepare feedback payload
            let failedReason = null;
            if (btn.getAttribute('data-feedback') === 'thumb_down' && typeof groundedAnswer === 'object' && groundedAnswer !== null) {
                failedReason = groundedAnswer.failedReason;
                groundedAnswer = groundedAnswer.groundedAnswer;
            }
            const payload = {
                response_id: responseId,
                question: lastUserMsg || '',
                answer: content,
                feedback: btn.getAttribute('data-feedback'),
                timestamp: new Date().toISOString(),
                grounded_answer: groundedAnswer || '',
                failed_reason: failedReason
            };
            fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => {
                    if (!res.ok) throw new Error('Failed to send feedback');
                    return res.json();
                })
                .then(() => {
                    feedbackStatus.textContent = 'Thank you for your feedback!';
                })
                .catch(() => {
                    feedbackStatus.textContent = 'Could not send feedback.';
                })
                .finally(() => {
                    // Re-enable buttons after submission
                    feedbackBtns.forEach(b => b.disabled = false);
                    // Keep the selected one highlighted
                    feedbackBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }

            // Modal for correction
            function showCorrectionModal(onSubmit) {
                // Remove any existing modal
                const existingModal = document.getElementById('correction-modal');
                if (existingModal) existingModal.remove();
                // Create modal overlay
                const overlay = document.createElement('div');
                overlay.id = 'correction-modal';
                overlay.style.position = 'fixed';
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.background = 'rgba(0,0,0,0.3)';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = 2000;
                // Modal content
                const modal = document.createElement('div');
                modal.style.background = '#fff';
                modal.style.padding = '2rem';
                modal.style.borderRadius = '8px';
                modal.style.maxWidth = '400px';
                modal.style.width = '100%';
                // Common failed reasons for RAG evaluation
                const failedReasons = [
                    'Hallucination (irrelevant or made-up info)',
                    'Missing citation',
                    'Incorrect citation',
                    'Incomplete answer',
                    'Outdated information',
                    'Poor language quality',
                    'Other'
                ];
                modal.innerHTML = `
                    <h5 class="mb-3">RAG Evaluation - Please select a failed reason</h5>
                    <select class="form-select mb-3" id="failed-reason-select">
                        ${failedReasons.map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
                    <div id="other-reason-container" style="display:none;">
                        <input type="text" class="form-control mb-3" id="other-reason-input" placeholder="Please specify the failed reason..." />
                    </div>
                    <h5 class="mb-3">What should the correct answer be?</h5>
                    <textarea class="form-control mb-3" rows="4" id="grounded-answer-input" placeholder="Please provide the correct answer here..."></textarea>
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-secondary" id="cancel-correction">Cancel</button>
                        <button class="btn btn-primary" id="submit-correction">Submit</button>
                    </div>
                `;
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                // Focus textarea
                setTimeout(() => {
                    document.getElementById('grounded-answer-input').focus();
                }, 100);
                // Show/hide other reason input
                const failedReasonSelect = document.getElementById('failed-reason-select');
                const otherReasonContainer = document.getElementById('other-reason-container');
                failedReasonSelect.addEventListener('change', function() {
                    if (this.value === 'Other') {
                        otherReasonContainer.style.display = '';
                    } else {
                        otherReasonContainer.style.display = 'none';
                    }
                });
                // Cancel
                document.getElementById('cancel-correction').onclick = () => {
                    overlay.remove();
                };
                // Submit
                document.getElementById('submit-correction').onclick = () => {
                    const groundedValue = document.getElementById('grounded-answer-input').value.trim();
                    let failedReason = failedReasonSelect.value;
                    if (failedReason === 'Other') {
                        const otherReason = document.getElementById('other-reason-input').value.trim();
                        if (otherReason) {
                            failedReason = failedReason + ': ' + otherReason;
                        }
                    }
                    overlay.remove();
                    onSubmit({ groundedAnswer: groundedValue, failedReason });
                };
            }
        }, 200);
    }
    
    /**
     * Shows a modal with citation details
     */
    function showCitationModal(citationData) {
        // Remove any existing modal
        const existingOverlay = document.querySelector('.citation-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Format the citation content for better display
        let formattedContent = citationData.content || 'No content available';
        
        // Create overlay and modal
        const overlay = document.createElement('div');
        overlay.className = 'citation-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'citation-modal-title');
        
        overlay.innerHTML = `
            <div class="citation-modal">
                <div class="citation-modal-header">
                    <h5 class="citation-modal-title" id="citation-modal-title">${citationData.title || 'Citation'}</h5>
                    <button type="button" class="citation-close-button" aria-label="Close">&times;</button>
                </div>
                <div class="citation-modal-body">
                    <pre class="citation-content">${formattedContent}</pre>
                    ${citationData.filePath ? `<div class="citation-source mt-3"><strong>Source:</strong> ${citationData.filePath}</div>` : ''}
                    ${citationData.url ? `<div class="citation-url mt-2"><strong>URL:</strong> <a href="${citationData.url}" target="_blank" rel="noopener noreferrer">${citationData.url}</a></div>` : ''}
                </div>
            </div>
        `;
        
        // Add overlay to the document
        document.body.appendChild(overlay);
        
        // Set focus on the modal container for keyboard navigation
        const modal = overlay.querySelector('.citation-modal');
        modal.focus();
        
        // Handle close button click
        const closeButton = overlay.querySelector('.citation-close-button');
        closeButton.addEventListener('click', () => {
            overlay.remove();
        });
        
        // Close modal when clicking outside
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Close modal on escape key
        document.addEventListener('keydown', function closeOnEscape(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', closeOnEscape);
            }
        });
    }
    
    /**
     * Displays an error message
     */
    function showError(text) {
        errorMessage.textContent = text;
        errorContainer.classList.remove('d-none');
    }
    
    /**
     * Hides the error message
     */
    function hideError() {
        errorContainer.classList.add('d-none');
    }
    
    /**
     * Shows the loading indicator
     */
    function showLoading() {
        loadingIndicator.classList.remove('d-none');
        sendButton.disabled = true;
        btnPersonalInfo.disabled = true;
        btnWarranty.disabled = true;
        btnCompany.disabled = true;
    }
    
    /**
     * Hides the loading indicator
     */
    function hideLoading() {
        loadingIndicator.classList.add('d-none');
        sendButton.disabled = false;
        btnPersonalInfo.disabled = false;
        btnWarranty.disabled = false;
        btnCompany.disabled = false;
    }
    
    /**
     * Scrolls the chat container to the bottom
     */
    function scrollToBottom() {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
    }
    
    /**
     * Sends a user message to the server for RAG processing
     * 
     * This function:
     * 1. Adds the user message to the UI
     * 2. Sends the entire conversation history to the FastAPI backend
     * 3. Processes the response from Azure OpenAI enhanced with Azure AI Search results
     * 4. Extracts any citations from the context
     * 5. Handles errors gracefully with user-friendly messages
     */
    function sendMessage(text) {
        hideError();
        
        // Add user message to UI
        addUserMessage(text);
        
        // Clear input field
        chatInput.value = '';
        
        // Add user message to chat history
        const userMessage = {
            role: 'user',
            content: text
        };
        messages.push(userMessage);
        
        // Show loading indicator
        showLoading();
        
        // Send request to server
        fetch('/api/chat/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages
            })
        })
        .then(response => {
            if (!response.ok) {
                // Try to parse the error response
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
                }).catch(e => {
                    // If can't parse JSON, use generic error
                    throw new Error(`HTTP error! Status: ${response.status}`);
                });
            }
            // Log raw response for debugging
            return response.json();
        })
        .then(data => {
            hideLoading();
            
            if (data.error) {
                // Handle API error
                showError(data.message || 'An error occurred');
                return;
            }
            
            const choice = data.choices && data.choices.length > 0 ? data.choices[0] : null;
            if (!choice || !choice.message || !choice.message.content) {
                showError('No answer received from the AI service.');
                return;
            }
            
            // Get message data
            const message = choice.message;
            const content = message.content;
            
            // Extract citations from context
            const citations = message.context?.citations || [];
            
            // Add assistant message to UI and store response_id
            addAssistantMessage(content, citations, data.response_id);
            
            // Add assistant message to chat history
            const assistantMessage = {
                role: 'assistant',
                content: content
            };
            messages.push(assistantMessage);
        })
        .catch(error => {
            hideLoading();
            showError(`Error: ${error.message}`);
            console.error('Error:', error);
        });
    }
});

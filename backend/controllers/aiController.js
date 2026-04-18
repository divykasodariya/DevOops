/**
 * AI Controller
 * Proxies chat requests from the React Native frontend to the FastAPI AI service.
 * Passes the user's JWT token so FastAPI can call back into Node APIs on behalf of the user.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const chatWithAI = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Extract JWT token from cookie or Authorization header
    let token = req.cookies?.jwt || '';
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Build the payload for FastAPI /api/copilot/agent
    const payload = {
      message:    message.trim(),
      session_id: req.user._id.toString(),   // use user ID as session
      user_id:    req.user._id.toString(),
      role:       req.user.role || 'student',
      history,
      token,
    };

    // Forward to FastAPI
    const response = await fetch(`${AI_SERVICE_URL}/api/copilot/agent`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI service error (${response.status}):`, errText);
      return res.status(502).json({
        message: 'AI service returned an error',
        reply:   'Sorry, I\'m having trouble right now. Please try again in a moment.',
      });
    }

    const data = await response.json();

    return res.status(200).json({
      reply:      data.reply      || 'I couldn\'t generate a response.',
      tool_calls: data.tool_calls || [],
      results:    data.results    || {},
      thoughts:   data.thoughts   || '',
    });

  } catch (error) {
    console.error('AI controller error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      reply:   'Sorry, something went wrong. Please try again.',
    });
  }
};

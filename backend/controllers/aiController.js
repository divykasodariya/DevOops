/**
 * AI Controller
 * Proxies chat requests from the React Native frontend to the FastAPI AI service.
 * Passes the user's JWT token so FastAPI can call back into Node APIs on behalf of the user.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';

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
      message: message.trim(),
      session_id: req.user._id.toString(),   // use user ID as session
      user_id: req.user._id.toString(),
      role: req.user.role || 'student',
      history,
      token,
    };

    // Forward to FastAPI
    const response = await fetch(`${AI_SERVICE_URL}/api/copilot/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI service error (${response.status}):`, errText);
      return res.status(502).json({
        message: 'AI service returned an error',
        reply: 'Sorry, I\'m having trouble right now. Please try again in a moment.',
      });
    }

    const data = await response.json();

    return res.status(200).json({
      reply: data.reply || 'I couldn\'t generate a response.',
      tool_calls: data.tool_calls || [],
      results: data.results || {},
      thoughts: data.thoughts || '',
    });

  } catch (error) {
    console.error('AI controller error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      reply: 'Sorry, something went wrong. Please try again.',
    });
  }
};

/**
 * POST multipart field `audio` — forwards to Groq Whisper (same API key pattern as ai_services).
 */
export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'No audio file (field name: audio)' });
    }

    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return res.status(503).json({
        message: 'Speech-to-text is not configured (set GROQ_API_KEY on the server).',
      });
    }

    const ext = (req.file.originalname && req.file.originalname.includes('.'))
      ? req.file.originalname.split('.').pop()
      : 'm4a';
    const filename = `audio.${ext}`;
    const mime = req.file.mimetype || 'application/octet-stream';

    // Use global FormData + Blob — the `form-data` package + fetch() often truncates the body (Groq: multipart NextPart: EOF).
    const form = new FormData();
    form.append('model', GROQ_WHISPER_MODEL);
    form.append('file', new Blob([req.file.buffer], { type: mime }), filename);

    const response = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Groq transcribe error (${response.status}):`, errText);
      return res.status(502).json({ message: 'Transcription service returned an error.' });
    }

    const data = await response.json();
    const text = (data.text || '').trim();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('transcribeAudio error:', error);
    return res.status(500).json({ message: 'Failed to transcribe audio' });
  }
};

from openai import OpenAI
from config import api_key, model_name

llm_client=OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)

def call_llm(prompt: str):
    try:
        res = llm_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "Return clean output. JSON if required."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3  
        )
        return res.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"





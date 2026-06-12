/**
 * Local Ollama Llama 3 (8B) Integration Client (Step 9)
 * Used to feed website/company data to LLM to generate dynamic outreach icebreakers.
 */
async function generateOutreachIcebreaker(leadName, companyName, website) {
  const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const modelName = process.env.OLLAMA_MODEL || 'llama3';

  try {
    const prompt = `Write a short, highly professional, single-sentence email opening icebreaker line to ${leadName || 'a potential client'} who works at ${companyName || 'their business'} (website: ${website || 'N/A'}). Do not include greeting, structural formatting, or quotes. Just return the icebreaker line itself. Keep it under 15 words.`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.response ? data.response.trim() : '';
    }
  } catch (err) {
    console.warn(`[Ollama AI] Skipping icebreaker generation: ${err.message}`);
  }
  return '';
}

module.exports = {
  generateOutreachIcebreaker
};

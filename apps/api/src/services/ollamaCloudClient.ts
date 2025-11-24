/**
 * Ollama Client - Simple Version
 * Local (llava-phi3) for development
 * Cloud (llava-phi3) for production
 */

const OLLAMA_CLOUD_API_KEY = process.env.OLLAMA_CLOUD_API_KEY;
const OLLAMA_CLOUD_API_URL = process.env.OLLAMA_CLOUD_API_URL || 'https://api.ollama.cloud/v1';
const OLLAMA_LOCAL_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = 'llava-phi3'; // Same model everywhere

// Determine which endpoint to use
const USE_CLOUD = !!OLLAMA_CLOUD_API_KEY;
const API_URL = USE_CLOUD ? OLLAMA_CLOUD_API_URL : OLLAMA_LOCAL_API_URL;

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  images?: string[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
  };
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
}

/**
 * Call Ollama API (Cloud or Local)
 */
export async function generateOllamaResponse(
  request: OllamaGenerateRequest
): Promise<OllamaGenerateResponse | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header for cloud
    if (USE_CLOUD && OLLAMA_CLOUD_API_KEY) {
      headers['Authorization'] = `Bearer ${OLLAMA_CLOUD_API_KEY}`;
    }

    const response = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...request,
        model: OLLAMA_MODEL,
        stream: false,
      }),
    });

    if (!response.ok) {
      console.log(`   ✗ Ollama API failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data;
  } catch (error) {
    console.log(`   ✗ Ollama API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Check if Ollama is available (Cloud or Local)
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {};
    if (USE_CLOUD && OLLAMA_CLOUD_API_KEY) {
      headers['Authorization'] = `Bearer ${OLLAMA_CLOUD_API_KEY}`;
    }

    const response = await fetch(`${API_URL}/api/tags`, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    const models = data.models || [];
    const hasModel = models.some(
      (m: any) => m.name.includes('llava-phi3') || m.name.includes('llava')
    );

    if (USE_CLOUD) {
      console.log(`   ✓ Connected to Ollama Cloud`);
    } else {
      console.log(`   ✓ Connected to local Ollama`);
    }

    if (!hasModel) {
      console.log(`   ⚠ llava-phi3 not available`);
      if (!USE_CLOUD) {
        console.log(`   → Run: ollama pull llava-phi3`);
      }
      return false;
    }

    return true;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.log('   ⚠ Ollama connection timeout');
    } else {
      console.log(
        `   ⚠ Ollama connection error: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
    return false;
  }
}

/**
 * Get connection info (for debugging)
 */
export function getOllamaInfo(): {
  type: 'cloud' | 'local';
  url: string;
  model: string;
  hasApiKey: boolean;
} {
  return {
    type: USE_CLOUD ? 'cloud' : 'local',
    url: API_URL,
    model: OLLAMA_MODEL,
    hasApiKey: !!OLLAMA_CLOUD_API_KEY,
  };
}

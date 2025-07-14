const axios = require("axios");

class PiAPIImageGen {
    constructor() {
        this.apiKey = process.env.PIAPI_API_KEY;
        this.apiUrl = process.env.PIAPI_API_URL || "https://api.piapi.ai/api/v1/task";
        this.fluxModel = process.env.PIAPI_FLUX_MODEL || "Qubico/flux1-dev";
    }

    async generateImage(prompt) {
        if (!this.apiKey) {
            console.error("PiAPI API Key is not set.");
            return null;
        }

        try {
            const payload = {
                model: this.fluxModel,
                task_type: "txt2img",
                input: {
                    prompt: prompt,
                    width: 1024,
                    height: 1024,
                    // Add other parameters as needed for Flux model
                },
            };

            const headers = {
                "X-API-Key": this.apiKey,
                "Content-Type": "application/json",
            };

            console.log("Sending request to PiAPI:", JSON.stringify(payload));

            const response = await axios.post(this.apiUrl, payload, { headers });

            if (response.data && response.data.task_id) {
                const taskId = response.data.task_id;
                console.log(`Image generation task submitted to PiAPI: ${taskId}`);

                // Poll for results (PiAPI uses async task processing)
                let imageUrl = null;
                let status = "pending";
                const pollUrl = `${this.apiUrl}/${taskId}`;

                while (status === "pending" || status === "processing") {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                    const pollResponse = await axios.get(pollUrl, { headers });
                    status = pollResponse.data.status;
                    console.log(`PiAPI task ${taskId} status: ${status}`);

                    if (status === "completed" && pollResponse.data.output && pollResponse.data.output.image_url) {
                        imageUrl = pollResponse.data.output.image_url;
                        break;
                    } else if (status === "failed") {
                        console.error(`PiAPI task ${taskId} failed:`, pollResponse.data.error);
                        break;
                    }
                }

                return imageUrl;
            } else {
                console.error("Failed to submit image generation task to PiAPI:", response.data);
                return null;
            }
        } catch (error) {
            console.error("Error generating image with PiAPI:", error.response ? error.response.data : error.message);
            return null;
        }
    }
}

module.exports = PiAPIImageGen;



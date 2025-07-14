const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const Database = require('./database');

class StableHordeAPI {
    constructor() {
        this.apiKey = process.env.STABLE_HORDE_API_KEY || '0000000000';
        this.apiUrl = process.env.STABLE_HORDE_API_URL || 'https://stablehorde.net/api/v2';
        this.botName = process.env.BOT_NAME || 'Lily';
        this.db = new Database();
        
        // Character consistency settings
        this.characterPrompt = this.createCharacterPrompt();
        this.negativePrompt = this.createNegativePrompt();
        
        // Ensure images directory exists
        this.imagesDir = path.join(__dirname, '../public/images');
        fs.ensureDirSync(this.imagesDir);
    }

    createCharacterPrompt() {
        return `beautiful anime girl, ${this.botName}, long flowing hair, cute face, big expressive eyes, anime art style, high quality, detailed, masterpiece, perfect anatomy, consistent character design, kawaii, adorable, sweet expression, soft lighting, vibrant colors`;
    }

    createNegativePrompt() {
        return `ugly, deformed, blurry, bad anatomy, bad proportions, extra limbs, cloned face, malformed limbs, missing arms, missing legs, fused fingers, too many fingers, long neck, mutation, mutated, extra arms, extra legs, bad quality, low quality, worst quality, jpeg artifacts, signature, watermark, username, text, error, cropped, out of frame, duplicate`;
    }

    async generateImage(telegramId, customPrompt = null) {
        try {
            // Create the full prompt
            let fullPrompt = this.characterPrompt;
            
            if (customPrompt) {
                fullPrompt = `${this.characterPrompt}, ${customPrompt}`;
            } else {
                // Add variety to the images
                const variations = [
                    'smiling sweetly, happy expression',
                    'cute pose, winking, playful',
                    'shy expression, blushing, adorable',
                    'confident pose, beautiful smile',
                    'gentle expression, loving gaze',
                    'cheerful, bright smile, energetic',
                    'elegant pose, graceful, stunning',
                    'cute outfit, fashionable, stylish'
                ];
                
                const randomVariation = variations[Math.floor(Math.random() * variations.length)];
                fullPrompt = `${this.characterPrompt}, ${randomVariation}`;
            }

            // Submit generation request
            const requestData = {
                prompt: fullPrompt,
                params: {
                    sampler_name: "k_euler_a",
                    cfg_scale: 7.5,
                    denoising_strength: 0.75,
                    seed: Math.floor(Math.random() * 1000000).toString(),
                    height: 512,
                    width: 512,
                    seed_variation: 1000,
                    post_processing: ["RealESRGAN_x4plus"],
                    karras: true,
                    tiling: false,
                    hires_fix: false,
                    clip_skip: 2,
                    steps: 25
                },
                nsfw: true,
                trusted_workers: true,
                slow_workers: true,
                censor_nsfw: false,
                workers: [],
                worker_blacklist: false,
                models: ["Anything V3", "Counterfeit V2.5", "AbyssOrangeMix2", "Waifu Diffusion"],
                r2: true,
                shared: false,
                replacement_filter: true
            };

            // Add negative prompt
            if (this.negativePrompt) {
                requestData.params.negative_prompt = this.negativePrompt;
            }

            console.log('🎨 Submitting image generation request...');
            
            const submitResponse = await axios.post(`${this.apiUrl}/generate/async`, requestData, {
                headers: {
                    'apikey': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const requestId = submitResponse.data.id;
            console.log(`📝 Request submitted with ID: ${requestId}`);

            // Poll for completion
            const imageUrl = await this.pollForCompletion(requestId);
            
            if (imageUrl) {
                // Update user stats
                await this.db.updateStats('imageUsed');
                
                // Log image generation
                await this.db.addLog('image_generated', {
                    telegramId: telegramId,
                    requestId: requestId,
                    prompt: fullPrompt
                });
                
                console.log('✅ Image generated successfully');
                return imageUrl;
            } else {
                console.log('❌ Image generation failed');
                return null;
            }

        } catch (error) {
            console.error('Error generating image:', error);
            
            // Return fallback image URL or null
            return this.getFallbackImage();
        }
    }

    async pollForCompletion(requestId, maxAttempts = 30) {
        try {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                console.log(`🔄 Checking status (attempt ${attempt + 1}/${maxAttempts})...`);
                
                const statusResponse = await axios.get(`${this.apiUrl}/generate/check/${requestId}`, {
                    headers: {
                        'apikey': this.apiKey
                    },
                    timeout: 10000
                });

                const status = statusResponse.data;
                
                if (status.done) {
                    console.log('✅ Generation completed!');
                    
                    // Get the generated image
                    const resultResponse = await axios.get(`${this.apiUrl}/generate/status/${requestId}`, {
                        headers: {
                            'apikey': this.apiKey
                        },
                        timeout: 10000
                    });

                    const result = resultResponse.data;
                    
                    if (result.generations && result.generations.length > 0) {
                        const imageUrl = result.generations[0].img;
                        console.log('🖼️ Image URL received:', imageUrl);
                        return imageUrl;
                    }
                }

                if (status.faulted) {
                    console.log('❌ Generation faulted');
                    return null;
                }

                // Wait before next poll
                await this.sleep(3000); // 3 seconds
            }

            console.log('⏰ Polling timeout reached');
            return null;

        } catch (error) {
            console.error('Error polling for completion:', error);
            return null;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getFallbackImage() {
        // Return a placeholder image URL or null
        // You could host some default waifu images and return one randomly
        const fallbackImages = [
            'https://via.placeholder.com/512x512/FFB6C1/FFFFFF?text=Lily+💕',
            'https://via.placeholder.com/512x512/FFC0CB/FFFFFF?text=Your+Waifu+❤️',
            'https://via.placeholder.com/512x512/DDA0DD/FFFFFF?text=Image+Error+💔'
        ];
        
        return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    }

    async generateCustomImage(telegramId, customPrompt, nsfwLevel = 'mild') {
        try {
            let enhancedPrompt = this.characterPrompt;
            
            // Add NSFW elements based on level
            switch (nsfwLevel) {
                case 'mild':
                    enhancedPrompt += ', cute outfit, slightly revealing, suggestive pose';
                    break;
                case 'moderate':
                    enhancedPrompt += ', sexy outfit, alluring pose, seductive expression';
                    break;
                case 'explicit':
                    enhancedPrompt += ', nsfw, explicit content, adult themes';
                    break;
                default:
                    enhancedPrompt += ', cute and innocent';
            }
            
            enhancedPrompt += `, ${customPrompt}`;
            
            return await this.generateImage(telegramId, enhancedPrompt);
        } catch (error) {
            console.error('Error generating custom image:', error);
            return null;
        }
    }

    async getGenerationStats() {
        try {
            const response = await axios.get(`${this.apiUrl}/stats/img/totals`, {
                headers: {
                    'apikey': this.apiKey
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Error getting generation stats:', error);
            return null;
        }
    }

    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.apiUrl}/status/models`, {
                headers: {
                    'apikey': this.apiKey
                },
                timeout: 10000
            });

            return response.data.filter(model => model.type === 'image');
        } catch (error) {
            console.error('Error getting available models:', error);
            return [];
        }
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.apiUrl}/status/heartbeat`, {
                headers: {
                    'apikey': this.apiKey
                },
                timeout: 10000
            });

            return {
                success: true,
                message: 'Stable Horde API connection successful',
                status: response.data
            };
        } catch (error) {
            return {
                success: false,
                message: 'Stable Horde API connection failed',
                error: error.message
            };
        }
    }

    async getUserInfo() {
        try {
            const response = await axios.get(`${this.apiUrl}/find_user`, {
                headers: {
                    'apikey': this.apiKey
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    async getImageVariations(telegramId, basePrompt, count = 3) {
        try {
            const variations = [];
            const styleVariations = [
                'different pose, new angle',
                'different expression, unique mood',
                'different outfit, new style',
                'different background, scenic view',
                'different lighting, atmospheric'
            ];

            for (let i = 0; i < count; i++) {
                const variation = styleVariations[i % styleVariations.length];
                const variedPrompt = `${basePrompt}, ${variation}`;
                
                const imageUrl = await this.generateImage(telegramId, variedPrompt);
                if (imageUrl) {
                    variations.push(imageUrl);
                }
                
                // Small delay between generations
                await this.sleep(1000);
            }

            return variations;
        } catch (error) {
            console.error('Error generating image variations:', error);
            return [];
        }
    }

    createSeasonalPrompt() {
        const month = new Date().getMonth();
        const seasonalPrompts = {
            winter: 'winter outfit, cozy sweater, snow background, warm atmosphere',
            spring: 'spring dress, cherry blossoms, fresh flowers, bright colors',
            summer: 'summer outfit, beach scene, sunny day, vibrant mood',
            autumn: 'autumn clothes, fall leaves, warm colors, cozy feeling'
        };

        if (month >= 11 || month <= 1) return seasonalPrompts.winter;
        if (month >= 2 && month <= 4) return seasonalPrompts.spring;
        if (month >= 5 && month <= 7) return seasonalPrompts.summer;
        return seasonalPrompts.autumn;
    }

    async generateSeasonalImage(telegramId) {
        const seasonalPrompt = this.createSeasonalPrompt();
        return await this.generateImage(telegramId, seasonalPrompt);
    }
}

module.exports = StableHordeAPI;


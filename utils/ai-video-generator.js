const OpenAI = require('openai');
const Replicate = require('replicate');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { Logger } = require('./logger');

const execAsync = promisify(exec);

class AIVideoGenerator {
  constructor(credentials) {
    this.logger = new Logger('AIVideoGenerator');
    
    // Initialize AI services with graceful fallback
    // Support both old (credentials.openai) and new (credentials.providers.openai) structures
    const openaiKey = credentials.openai?.apiKey || credentials.providers?.openai?.apiKey || process.env.OPENAI_API_KEY;
    const replicateKey = credentials.replicate?.apiKey || credentials.videoProviders?.replicate?.apiKey || process.env.REPLICATE_API_KEY;
    const siliconflowKey = credentials.videoProviders?.siliconflow?.apiKey || process.env.SILICONFLOW_API_KEY;
    const falKey = credentials.videoProviders?.fal?.apiKey || process.env.FAL_API_KEY;
    const huggingfaceKey = credentials.videoProviders?.huggingface?.apiKey || process.env.HF_API_KEY;
    
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.info('OpenAI service initialized');
    } else {
      this.logger.warn('OpenAI API key not found - AI features will be simulated');
    }
    
    if (replicateKey) {
      this.replicate = new Replicate({ auth: replicateKey });
      this.logger.info('Replicate service initialized (Wan 2.7)');
    } else {
      this.logger.warn('Replicate API key not found');
    }
    
    // SiliconFlow (free credits, fast inference)
    this.siliconflowKey = siliconflowKey;
    if (siliconflowKey) {
      this.logger.info('SiliconFlow service initialized (Wan 2.2)');
    }
    
    // fal.ai
    this.falKey = falKey;
    if (falKey) {
      this.logger.info('fal.ai service initialized');
    }
    
    // Hugging Face Inference
    this.huggingfaceKey = huggingfaceKey;
    if (huggingfaceKey) {
      this.logger.info('Hugging Face Inference initialized');
    }
    
    // ElevenLabs configuration
    this.elevenLabsApiKey = credentials.elevenLabs?.apiKey || credentials.ttsProviders?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY;
    this.elevenLabsVoiceId = credentials.elevenLabs?.voiceId || credentials.ttsProviders?.elevenlabs?.voiceId || process.env.ELEVENLABS_VOICE_ID;
    
    // Azure Speech configuration
    this.azureSpeechKey = credentials.azure?.speechKey || credentials.azureSpeech?.subscriptionKey || credentials.ttsProviders?.azure?.subscriptionKey || process.env.AZURE_SPEECH_KEY;
    this.azureSpeechRegion = credentials.azure?.speechRegion || credentials.azureSpeech?.region || credentials.ttsProviders?.azure?.region || process.env.AZURE_SPEECH_REGION;
    
    // Additional video providers
    this.videoProviders = credentials.videoProviders || {};
    this.imageProviders = credentials.imageProviders || {};
  }

  async generateTTSAudio(text, outputPath) {
    this.logger.info('Generating TTS audio...');
    
    try {
      // Try ElevenLabs first (higher quality)
      if (this.elevenLabsApiKey && this.elevenLabsVoiceId) {
        return await this.generateElevenLabsTTS(text, outputPath);
      }
      
      // Fallback to OpenAI TTS
      if (this.openai) {
        return await this.generateOpenAITTS(text, outputPath);
      }
      
      // Final fallback to simulation
      return await this.simulateTTSGeneration(text, outputPath);
    } catch (error) {
      this.logger.error('TTS generation failed:', error);
      throw error;
    }
  }

  async generateElevenLabsTTS(text, outputPath) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`;
    
    const data = {
      text: text,
      model_id: "eleven_v3",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true
      }
    };

    const response = await axios({
      method: 'POST',
      url: url,
      data: data,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.elevenLabsApiKey
      },
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        this.logger.info('ElevenLabs TTS generation complete');
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  }

  async generateOpenAITTS(text, outputPath) {
    const response = await this.openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    
    this.logger.info('OpenAI TTS generation complete');
    return outputPath;
  }

  async generateVisualAssets(prompt, style = "ethereal", count = 1) {
    this.logger.info(`Generating ${count} visual assets with style: ${style}`);
    
    try {
      if (!this.openai) {
        return await this.simulateVisualAssets(prompt, style, count);
      }

      const enhancedPrompt = this.enhanceVisualPrompt(prompt, style);
      const localPaths = [];

      for (let i = 0; i < count; i++) {
        const response = await this.openai.images.generate({
          model: "gpt-image-2",
          prompt: enhancedPrompt,
          n: 1,
          size: "1536x1024",
          quality: "high",
        });

        const imagePath = path.join(__dirname, '..', 'data', 'assets', `visual_${Date.now()}_${i}.png`);
        if (response.data[0].b64_json) {
          const buffer = Buffer.from(response.data[0].b64_json, 'base64');
          await fs.writeFile(imagePath, buffer);
        } else {
          await this.downloadImage(response.data[0].url, imagePath);
        }
        localPaths.push(imagePath);
      }

      this.logger.info(`Generated ${localPaths.length} visual assets`);
      return localPaths;
    } catch (error) {
      this.logger.error('Visual asset generation failed:', error);
      return await this.simulateVisualAssets(prompt, style, count);
    }
  }

  enhanceVisualPrompt(prompt, style) {
    const styleEnhancements = {
      ethereal: "ethereal, dreamy, mystical, soft lighting, floating particles, cosmic background",
      modern: "modern, clean, minimalist, professional, sleek design, contemporary",
      animated: "animated style, cartoon, vibrant colors, expressive, dynamic",
      cinematic: "cinematic lighting, dramatic, movie poster style, high contrast",
      abstract: "abstract art, geometric shapes, gradient colors, artistic composition"
    };

    const enhancement = styleEnhancements[style] || styleEnhancements.ethereal;
    return `${prompt}, ${enhancement}, high quality, 16:9 aspect ratio, digital art`;
  }

  async downloadImage(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async generateVideo(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Generating video from assets...');
    
    // Try providers in order of preference (free first)
    const providers = [
      { name: 'SiliconFlow', fn: () => this.generateSiliconFlowVideo(script, visualAssets, audioPath, outputPath) },
      { name: 'Replicate', fn: () => this.generateReplicateVideo(script, visualAssets, audioPath, outputPath) },
      { name: 'fal.ai', fn: () => this.generateFalVideo(script, visualAssets, audioPath, outputPath) },
      { name: 'HuggingFace', fn: () => this.generateHuggingFaceVideo(script, visualAssets, audioPath, outputPath) },
      { name: 'Slideshow', fn: () => this.generateSlideshowVideo(script, visualAssets, audioPath, outputPath) }
    ];

    for (const provider of providers) {
      try {
        this.logger.info(`Trying ${provider.name}...`);
        return await provider.fn();
      } catch (error) {
        this.logger.warn(`${provider.name} failed: ${error.message}`);
        continue;
      }
    }
    
    // Final fallback
    return await this.simulateVideoGeneration(script, visualAssets, audioPath, outputPath);
  }

  async generateReplicateVideo(script, visualAssets, audioPath, outputPath) {
    if (!this.replicate || !this.replicate.auth) {
      throw new Error('Replicate not configured');
    }

    const output = await this.replicate.run(
      "wan-video/wan-2.7-i2v",
      {
        input: {
          image: visualAssets[0],
          prompt: script.title || "smooth cinematic motion",
          duration: 5,
          resolution: "720p"
        }
      }
    );

    // Download the generated video
    if (output && output.length > 0) {
      await this.downloadVideo(output[0], outputPath);
      
      // Add audio track
      await this.addAudioToVideo(outputPath, audioPath, outputPath);
    }

    return outputPath;
  }

  async generateSiliconFlowVideo(script, visualAssets, audioPath, outputPath) {
    if (!this.siliconflowKey) {
      throw new Error('SiliconFlow not configured');
    }

    const axios = require('axios');
    
    // SiliconFlow API - Wan 2.1 text-to-video
    const response = await axios.post(
      'https://api.siliconflow.cn/v1/video/submit',
      {
        model: 'Wan-AI/Wan2.1-T2V-A14B',
        prompt: script.title || "smooth cinematic motion, high quality",
        image_url: visualAssets[0] || undefined
      },
      {
        headers: {
          'Authorization': `Bearer ${this.siliconflowKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const taskId = response.data.task_id;
    if (!taskId) {
      throw new Error('No task ID returned from SiliconFlow');
    }

    // Poll for completion
    let result = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const statusResponse = await axios.get(
        `https://api.siliconflow.cn/v1/video/status/${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${this.siliconflowKey}` }
        }
      );

      if (statusResponse.data.status === 'succeeded') {
        result = statusResponse.data.video_url;
        break;
      } else if (statusResponse.data.status === 'failed') {
        throw new Error('SiliconFlow video generation failed');
      }
    }

    if (result) {
      await this.downloadVideo(result, outputPath);
      await this.addAudioToVideo(outputPath, audioPath, outputPath);
    }

    return outputPath;
  }

  async generateFalVideo(script, visualAssets, audioPath, outputPath) {
    if (!this.falKey) {
      throw new Error('fal.ai not configured');
    }

    const axios = require('axios');
    
    // fal.ai API - Wan 2.1
    const response = await axios.post(
      'https://fal.run/fal-ai/wan/v2.1/t2v',
      {
        prompt: script.title || "smooth cinematic motion",
        num_frames: 81,
        fps: 24
      },
      {
        headers: {
          'Authorization': `Key ${this.falKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.video?.url) {
      await this.downloadVideo(response.data.video.url, outputPath);
      await this.addAudioToVideo(outputPath, audioPath, outputPath);
    }

    return outputPath;
  }

  async generateHuggingFaceVideo(script, visualAssets, audioPath, outputPath) {
    if (!this.huggingfaceKey) {
      throw new Error('Hugging Face not configured');
    }

    const axios = require('axios');
    
    // Hugging Face Inference API - Wan 2.1
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/Wan-AI/Wan2.1-T2V-14B',
      {
        inputs: script.title || "smooth cinematic motion, high quality"
      },
      {
        headers: {
          'Authorization': `Bearer ${this.huggingfaceKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return outputPath;
  }

  async generateSlideshowVideo(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Creating slideshow video...');
    
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Create HTML for slideshow
    const slideshowHtml = this.createSlideshowHTML(script, visualAssets);
    
    // Set page content
    await page.setContent(slideshowHtml);
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Record video of the slideshow
    const videoPath = outputPath.replace('.mp4', '_visual.mp4');
    
    // Use Playwright to record
    await page.waitForTimeout(1000); // Wait for assets to load
    
    // Create video frames by taking screenshots at intervals
    const duration = this.calculateScriptDuration(script);
    const frameCount = Math.ceil(duration * 30); // 30 FPS
    const frameInterval = duration / frameCount * 1000;

    const framesDir = path.join(path.dirname(outputPath), 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    for (let i = 0; i < frameCount; i++) {
      await page.screenshot({
        path: path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`),
        fullPage: true
      });
      
      // Advance animation
      await page.evaluate(() => {
        if (window.advanceAnimation) {
          window.advanceAnimation();
        }
      });
      
      await page.waitForTimeout(frameInterval);
    }

    await browser.close();

    // Convert frames to video using FFmpeg
    const ffmpegCommand = `ffmpeg -framerate 30 -i "${framesDir}/frame_%06d.png" -c:v libx264 -pix_fmt yuv420p "${videoPath}"`;
    await execAsync(ffmpegCommand);

    // Add audio
    await this.addAudioToVideo(videoPath, audioPath, outputPath);

    // Cleanup frames
    await this.cleanupDirectory(framesDir);

    return outputPath;
  }

  createSlideshowHTML(script, visualAssets) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 1920px;
            height: 1080px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Arial', sans-serif;
            overflow: hidden;
        }
        
        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 2s ease-in-out;
        }
        
        .slide.active {
            opacity: 1;
        }
        
        .content {
            text-align: center;
            color: white;
            max-width: 80%;
        }
        
        h1 {
            font-size: 72px;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        
        h2 {
            font-size: 48px;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        
        p {
            font-size: 36px;
            line-height: 1.4;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        
        .background-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.3;
            z-index: -1;
        }
        
        .particles {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: -1;
        }
        
        .particle {
            position: absolute;
            background: rgba(255,255,255,0.8);
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
    </style>
</head>
<body>
    <div class="particles"></div>
    
    <!-- Title Slide -->
    <div class="slide active">
        ${visualAssets[0] ? `<img class="background-image" src="${visualAssets[0]}" />` : ''}
        <div class="content">
            <h1>${script.title}</h1>
            <p>Ethereal Dreamscript</p>
        </div>
    </div>
    
    ${this.generateContentSlides(script, visualAssets).join('')}
    
    <!-- Subscribe Slide -->
    <div class="slide">
        <div class="content">
            <h2>✨ Subscribe for More Stories ✨</h2>
            <p>New content daily at 2:00 PM</p>
        </div>
    </div>
    
    <script>
        // Create floating particles
        function createParticles() {
            const container = document.querySelector('.particles');
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.width = (Math.random() * 4 + 2) + 'px';
                particle.style.height = particle.style.width;
                particle.style.animationDelay = Math.random() * 6 + 's';
                container.appendChild(particle);
            }
        }
        
        let currentSlide = 0;
        const slides = document.querySelectorAll('.slide');
        
        function advanceAnimation() {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }
        
        window.advanceAnimation = advanceAnimation;
        createParticles();
    </script>
</body>
</html>`;
  }

  generateContentSlides(script, visualAssets) {
    const slides = [];
    
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach((section, index) => {
        const assetIndex = Math.min(index + 1, visualAssets.length - 1);
        
        slides.push(`
        <div class="slide">
            ${visualAssets[assetIndex] ? `<img class="background-image" src="${visualAssets[assetIndex]}" />` : ''}
            <div class="content">
                <h2>${section.title}</h2>
                ${this.formatSectionContent(section)}
            </div>
        </div>`);
      });
    }
    
    return slides;
  }

  formatSectionContent(section) {
    if (section.items && Array.isArray(section.items)) {
      return section.items.slice(0, 3).map(item => 
        `<p>${item.number}. ${item.title}</p>`
      ).join('');
    }
    
    if (section.steps && Array.isArray(section.steps)) {
      return section.steps.slice(0, 3).map(step => 
        `<p>${step.title}</p>`
      ).join('');
    }
    
    if (typeof section.content === 'string') {
      return `<p>${section.content.slice(0, 200)}${section.content.length > 200 ? '...' : ''}</p>`;
    }
    
    return '<p>Content coming soon...</p>';
  }

  calculateScriptDuration(script) {
    // Estimate duration based on word count (average 150 words per minute)
    let totalWords = 0;
    
    if (script.hook) totalWords += script.hook.text.split(' ').length;
    if (script.introduction) {
      totalWords += (script.introduction.greeting || '').split(' ').length;
      totalWords += (script.introduction.topicIntro || '').split(' ').length;
    }
    
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        if (typeof section.content === 'string') {
          totalWords += section.content.split(' ').length;
        }
        if (section.items) {
          section.items.forEach(item => {
            totalWords += (item.title + ' ' + item.description).split(' ').length;
          });
        }
        if (section.steps) {
          section.steps.forEach(step => {
            totalWords += (step.title + ' ' + step.description).split(' ').length;
          });
        }
      });
    }
    
    if (script.conclusion) {
      totalWords += script.conclusion.finalThought.split(' ').length;
    }
    
    // Convert to duration (150 words per minute)
    return Math.max(30, Math.ceil((totalWords / 150) * 60));
  }

  async addAudioToVideo(videoPath, audioPath, outputPath) {
    const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`;
    await execAsync(command);
    this.logger.info('Audio added to video successfully');
  }

  async downloadVideo(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        await fs.unlink(path.join(dirPath, file));
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      this.logger.warn('Cleanup failed:', error.message);
    }
  }

  async generateThumbnail(script, style = "ethereal") {
    this.logger.info('Generating custom thumbnail...');
    
    try {
      if (!this.openai) {
        return await this.simulateThumbnailGeneration(script, style);
      }

      const prompt = `YouTube thumbnail for "${script.title}", ${style} style, eye-catching, high contrast text, professional design, clickable, engaging`;
      
      const response = await this.openai.images.generate({
        model: "gpt-image-2",
        prompt: prompt,
        n: 1,
        size: "1536x1024",
        quality: "high"
      });

      const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_${Date.now()}.png`);
      await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });

      if (response.data[0].b64_json) {
        const buffer = Buffer.from(response.data[0].b64_json, 'base64');
        await fs.writeFile(thumbnailPath, buffer);
      } else {
        await this.downloadImage(response.data[0].url, thumbnailPath);
      }

      return {
        path: thumbnailPath,
        dimensions: { width: 1536, height: 1024 },
        fileSize: await this.getFileSize(thumbnailPath)
      };
    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error);
      return await this.simulateThumbnailGeneration(script, style);
    }
  }

  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  // Simulation methods for when APIs are not available
  async simulateTTSGeneration(text, outputPath) {
    this.logger.info('Simulating TTS generation...');
    
    const infoPath = outputPath + '.info';
    await fs.writeFile(infoPath, JSON.stringify({
      message: 'AI TTS audio would be generated here',
      text: text.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return infoPath;
  }

  async simulateVisualAssets(prompt, style, count) {
    this.logger.info(`Simulating ${count} visual assets...`);
    
    const paths = [];
    for (let i = 0; i < count; i++) {
      const assetPath = path.join(__dirname, '..', 'data', 'assets', `visual_sim_${Date.now()}_${i}.info`);
      
      await fs.writeFile(assetPath, JSON.stringify({
        message: 'AI visual asset would be generated here',
        prompt: prompt,
        style: style,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      paths.push(assetPath);
    }
    
    return paths;
  }

  async simulateVideoGeneration(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Simulating video generation...');
    
    const infoPath = outputPath + '.info';
    await fs.writeFile(infoPath, JSON.stringify({
      message: 'AI video would be generated here',
      script: script.title,
      visualAssets: visualAssets.length,
      audioPath: audioPath,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return infoPath;
  }

  async simulateThumbnailGeneration(script, style) {
    this.logger.info('Simulating thumbnail generation...');
    
    const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_sim_${Date.now()}.info`);
    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    
    await fs.writeFile(thumbnailPath, JSON.stringify({
      message: 'AI thumbnail would be generated here',
      title: script.title,
      style: style,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return {
      path: thumbnailPath,
      dimensions: { width: 1792, height: 1024 },
      fileSize: 1024,
      simulated: true
    };
  }
}

module.exports = { AIVideoGenerator };
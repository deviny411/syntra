import express, { Request, Response } from "express";
import axios from "axios";
import * as xml2js from "xml2js";
import { geminiService } from "../services/geminiService";

const router = express.Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_YT_URL = "https://www.googleapis.com/youtube/v3/search";

const axiosConfig = {
  headers: {
    'User-Agent': 'syntra-dev/0.1 (mailto:your@email.com)' // Replace with your real email here
  }
};

// Wikipedia fetch - try exact match first, then search for best match
async function fetchWikipediaSummary(concept: string) {
  try {
    // First try exact match
    const exactUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(concept)}`;
    console.log(`[Wikipedia] Trying exact match for '${concept}'`);
    try {
      const res = await axios.get(exactUrl, axiosConfig);
      console.log(`[Wikipedia] Found exact match for '${concept}'`);
      return {
        title: res.data.title,
        summary: res.data.extract,
        url: res.data.content_urls?.desktop?.page,
        image: res.data.thumbnail?.source,
        isAiGenerated: false,
      };
    } catch (exactErr: any) {
      if (exactErr.response?.status !== 404) {
        throw exactErr;
      }
      // 404 - try search
    }

    // If exact match fails, search for best match using MediaWiki API
    console.log(`[Wikipedia] No exact match, searching for '${concept}'`);
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    const searchRes = await axios.get(searchUrl, {
      ...axiosConfig,
      params: {
        action: 'query',
        list: 'search',
        srsearch: concept,
        format: 'json',
        srlimit: 1,
      },
    });

    const results = searchRes.data.query?.search;
    if (!results || results.length === 0) {
      console.warn(`[Wikipedia] No search results for '${concept}', using AI summary`);
      // Use AI summary as fallback
      const aiSummary = await geminiService.generateConceptSummary(concept);
      return {
        title: aiSummary.title,
        summary: aiSummary.summary,
        url: null,
        image: null,
        isAiGenerated: true,
      };
    }

    const topResult = results[0];
    const resultTitle = topResult.title.toLowerCase();
    const conceptLower = concept.toLowerCase();
    
    // Check if result is completely unrelated (check for any word overlap)
    const conceptWords = conceptLower.split(/\s+/).filter((w: string) => w.length > 2); // Ignore short words like "in", "of"
    const resultWords = resultTitle.split(/\s+/).filter((w: string) => w.length > 2);
    
    // Check if at least ONE significant word matches
    const hasAnyMatch = conceptWords.some((cWord: string) => 
      resultWords.some((rWord: string) => 
        cWord.includes(rWord) || rWord.includes(cWord) || cWord === rWord
      )
    );
    
    console.log(`[Wikipedia] Found best match: '${topResult.title}' for '${concept}' (hasMatch: ${hasAnyMatch})`);
    
    // Only use AI if completely unrelated (no word matches at all)
    if (!hasAnyMatch) {
      console.warn(`[Wikipedia] Result completely unrelated, using AI summary`);
      const aiSummary = await geminiService.generateConceptSummary(concept);
      return {
        title: aiSummary.title,
        summary: aiSummary.summary,
        url: null,
        image: null,
        isAiGenerated: true,
      };
    }

    // Now fetch the summary of the top search result
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topResult.title)}`;
    const summaryRes = await axios.get(summaryUrl, axiosConfig);

    return {
      title: summaryRes.data.title,
      summary: summaryRes.data.extract,
      url: summaryRes.data.content_urls?.desktop?.page,
      image: summaryRes.data.thumbnail?.source,
      isAiGenerated: false,
    };
  } catch (err: any) {
    console.error(`[Wikipedia] Error for '${concept}':`, err.response?.status, err.response?.data?.title || err.message);
    console.warn(`[Wikipedia] Falling back to AI summary due to error`);
    // Fallback to AI summary on any error
    try {
      const aiSummary = await geminiService.generateConceptSummary(concept);
      return {
        title: aiSummary.title,
        summary: aiSummary.summary,
        url: null,
        image: null,
        isAiGenerated: true,
      };
    } catch (aiErr) {
      console.error(`[AI Summary] Failed:`, aiErr);
      return null;
    }
  }
}

// arXiv fetch
async function fetchArxivPapers(concept: string) {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(concept)}&start=0&max_results=3`;
  try {
    const res = await axios.get(url, axiosConfig);
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const entries = parsed.feed.entry;
    if (!entries) {
      console.warn(`[arXiv] No papers found for '${concept}'`);
      return [];
    }
    const papers = Array.isArray(entries) ? entries : [entries];
    console.log(`[arXiv] Success for '${concept}': ${papers.length} papers found.`);
    return papers.map((paper: any) => ({
      title: (paper.title || '').replace(/\s+/g, ' ').trim(),
      summary: (paper.summary || '').replace(/\s+/g, ' ').trim(),
      pdfUrl: (Array.isArray(paper.link)
        ? paper.link.find((l: any) => l.$.type === 'application/pdf')?.$.href
        : paper.link?.$.href) || '',
      authors: paper.author
        ? Array.isArray(paper.author)
          ? paper.author.map((a: any) => a.name)
          : [paper.author.name]
        : [],
      published: paper.published,
    }));
  } catch (err: any) {
    console.error(`[arXiv] Error for '${concept}':`, err.message);
    // Gracefully return empty array on failure to keep API healthy
    return [];
  }
}

// YouTube fetch
async function fetchYouTubeVideos(concept: string) {
  console.log(`[YouTube] Starting fetch for '${concept}'`);
  if (!YOUTUBE_API_KEY) {
    console.error(`[YouTube] YOUTUBE_API_KEY is missing!`);
    throw new Error('Missing YOUTUBE_API_KEY!');
  }
  console.log(`[YouTube] API Key present: ${YOUTUBE_API_KEY.substring(0, 10)}...`);
  
  const params = {
    key: YOUTUBE_API_KEY,
    part: 'snippet',
    type: 'video',
    q: concept,
    maxResults: 5,
  };
  console.log(`[YouTube] Params:`, { ...params, key: params.key.substring(0, 10) + '...' });
  
  try {
    console.log(`[YouTube] Requesting: ${BASE_YT_URL}`);
    const res = await axios.get(BASE_YT_URL, { params });
    console.log(`[YouTube] Response status: ${res.status}`);
    console.log(`[YouTube] Response data keys:`, Object.keys(res.data));
    console.log(`[YouTube] Items count:`, res.data.items?.length || 0);
    console.log(`[YouTube] Success for '${concept}': ${res.data.items?.length || 0} videos found.`);
    
    const videos = (res.data.items || []).map((item: any) => ({
      title: item.snippet.title,
      description: item.snippet.description,
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }));
    console.log(`[YouTube] Mapped ${videos.length} videos successfully`);
    return videos;
  } catch (err: any) {
    console.error(`[YouTube] Full error object:`, {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      config: err.config?.url,
    });
    console.error(`[YouTube] Error for '${concept}':`, err.response?.status, err.response?.data || err.message);
    throw new Error('YouTube fetch failed');
  }
}


// Main route for Wikipedia + YouTube (fast)
router.get("/concept/:concept", async (req: Request, res: Response) => {
  const { concept } = req.params;
  console.log(`Received GET /concept/${concept}`);
  // Wrap both fetches to handle failures gracefully
  const [wiki, youtube] = await Promise.all([
    fetchWikipediaSummary(concept).catch((err) => {
      console.warn(`[Wikipedia] Graceful fallback for '${concept}':`, err.message);
      return null;
    }),
    fetchYouTubeVideos(concept).catch((err) => {
      console.warn(`[YouTube] Graceful fallback for '${concept}':`, err.message);
      return [];
    }),
  ]);
  res.json({ wikipedia: wiki, youtube });
});

// Separate route to fetch arXiv data (slower, possibly failing)
router.get("/concept/arxiv/:concept", async (req: Request, res: Response) => {
  const { concept } = req.params;
  console.log(`Received GET /concept/arxiv/${concept}`);
  try {
    const arxiv = await fetchArxivPapers(concept);
    res.json(arxiv);
  } catch (err: any) {
    console.error(`Error serving arXiv for '${concept}':`, err.message);
    res.status(500).json([]);
  }
});

export default router;

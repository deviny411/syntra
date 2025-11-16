const axios = require('axios');
const xml2js = require('xml2js');

const axiosConfig = {
  headers: {
    'User-Agent': 'syntra-dev/0.1 (mailto:tup0411@gmail.com)' // Replace with your email!
  }
};

// Wikipedia summary fetch
async function fetchWikipediaSummary(concept) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(concept)}`;
  const res = await axios.get(url, axiosConfig);
  return {
    title: res.data.title,
    summary: res.data.extract,
    url: res.data.content_urls?.desktop?.page,
    image: res.data.thumbnail?.source
  };
}

// Arxiv paper fetch
async function fetchArxivPapers(concept) {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(concept)}&start=0&max_results=3`;
  const res = await axios.get(url, axiosConfig);
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
  const entries = parsed.feed.entry;
  if (!entries) return [];
  const papers = Array.isArray(entries) ? entries : [entries];

  return papers.map(paper => ({
    title: (paper.title || '').replace(/\s+/g, ' ').trim(),
    summary: (paper.summary || '').replace(/\s+/g, ' ').trim(),
    pdfUrl: (Array.isArray(paper.link) 
      ? paper.link.find(l => l.$.type === 'application/pdf')?.$.href
      : paper.link?.$.href) || '',
    authors: paper.author
      ? Array.isArray(paper.author)
        ? paper.author.map(a => a.name)
        : [paper.author.name]
      : [],
    published: paper.published
  }));
}

// Test function
async function testConceptRetrieval(concept) {
  console.log(`Testing retrieval for concept: "${concept}"`);
  try {
    const wiki = await fetchWikipediaSummary(concept);
    const arxiv = await fetchArxivPapers(concept);
    console.log('Wikipedia:');
    console.log(wiki);
    console.log('\nArxiv papers:');
    arxiv.forEach((p, i) => {
      console.log(`\n[${i + 1}] ${p.title}`);
      console.log(`Authors: ${p.authors.join(', ')}`);
      console.log(`Published: ${p.published}`);
      console.log(`PDF: ${p.pdfUrl}`);
      console.log(`Summary: ${p.summary.substring(0, 150)}...`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Change concept/topic here for tests
testConceptRetrieval("Graph Theory");

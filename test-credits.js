async function fetchWikiCredits(title, artist) {
    const query = `${title} ${artist} song`;
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
    const data = await res.json();
    if (data.query && data.query.search.length > 0) {
        const pageTitle = data.query.search[0].title;
        // fetch sections
        const secRes = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=sections&format=json&origin=*`);
        const secData = await secRes.json();
        
        const sections = secData.parse?.sections || [];
        const creditSec = sections.find(s => s.line.toLowerCase().includes('personnel') || s.line.toLowerCase().includes('credit'));
        
        if (creditSec) {
            const textRes = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&section=${creditSec.index}&prop=text&format=json&origin=*`);
            const textData = await textRes.json();
            console.log("Found Credits HTML length:", textData.parse.text['*'].length);
            // Can strip tags via regex
            const text = textData.parse.text['*'].replace(/<[^>]+>/g, '').replace(/\[\d+\]/g, '').trim();
            console.log(text.substring(0, 500));
        } else {
            console.log("No credits section found.");
        }
    }
}
fetchWikiCredits("Who's Lovin' You", "Jackson 5");

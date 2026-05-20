async function fetchWiki() {
    const artist = "Jackson 5";
    const title = "Who's Lovin' You";
    const query = `${artist} ${title}`;
    try {
        const res = await fetch(`https://ko.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
        const data = await res.json();
        if (data.query && data.query.search.length > 0) {
            const pageTitle = data.query.search[0].title;
            const sumRes = await fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
            const sumData = await sumRes.json();
            console.log("KO:", sumData.extract);
        } else {
            console.log("No KO results");
        }
    } catch (e) {
        console.error(e);
    }
}
fetchWiki();

async function fetchWiki(title, artist) {
    let summary = null;
    
    // try ko 
    try {
        let res = await fetch(`https://ko.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' ' + artist)}&format=json&origin=*`);
        let data = await res.json();
        if (data.query?.search?.length > 0) {
            let sumRes = await fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(data.query.search[0].title)}`);
            let sumData = await sumRes.json();
            if (sumData.extract) summary = sumData.extract;
        }
    } catch(e) {}

    // try en if ko fails or is too short?
    if (!summary) {
        try {
            let res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' ' + artist + ' song')}&format=json&origin=*`);
            let data = await res.json();
            if (data.query?.search?.length > 0) {
                let sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(data.query.search[0].title)}`);
                let sumData = await sumRes.json();
                if (sumData.extract) summary = sumData.extract;
            }
        } catch (e) {}
    }
    
    console.log(summary);
}

fetchWiki("Who's Lovin' You", "Jackson 5");

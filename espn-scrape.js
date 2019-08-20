// npm install puppeteer mongodb --save
const puppeteer = require('puppeteer');
const keys = require('./keys');
const MongoClient = require('mongodb').MongoClient;
const uri = keys.MONGODBURI;
const client = new MongoClient(uri, { useNewUrlParser: true });

// here is our main scrape function
const scrape = async () => {
    
    // set up our puppeteer scrape
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // request the URL
    await page.goto('https://fantasy.espn.com/football/players/projections');
    
    // set-up array that will hold the results
    var results = [];

    // need to loop through each page
    // currently this URL has 50 players on each page and 21 pages
    // create variable to hold the number of pages
    var lastPageNumber = 21;

    // you are on page one when the script starts
    // create a loop that starts at one and ends at the last page
    for (let index = 1; index < lastPageNumber + 1; index++) {
        // give the site a second to load
        await page.waitFor(1000);
        
        // concat the results of your extracted data to the existing results
        // SEE extractedEvaluateCall below...
        results = results.concat(await extractedEvaluateCall(page));

        // as long as it's not the last page then click the arrow to go to the next page
        if (index != lastPageNumber) {
            let target = parseInt(index) + 1;
            await page.click('[data-nav-item="'+target+'"]');
        }
    }

    // all done close the browser
    browser.close();

    // return the complete results array
    return results;
};

const extractedEvaluateCall = async (page) => {
    
    // evaluate the page
    return page.evaluate(() => {

        // create an array to hold the data from the page
        let data = [];

        // target each player table
        let elements = document.querySelectorAll('.full-projection-table');

        // loop through the tables
        for (var element of elements) {

            // grab the name, position, team, and espn_rank
            let name = element.querySelector('.link.pointer').textContent;            
            let position = element.querySelector('.playerinfo__playerpos').textContent;
            let team = element.querySelector('.pro-team-name').textContent;            
            let espn_rank = element.querySelector('.playerInfo__rank.Table2__td').childNodes[0].textContent;
            
            // clean and normalize the data
            name = name.trim();
            position = position.trim().toLowerCase();
            team = team.trim().toLowerCase();
            espn_rank = espn_rank.trim();

            // create a unique string that could be used as a key later
            let clean_name = name.replace(/\.?([A-Z]+)/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "").replace(" ", "");

            // create objects to hold the stats
            let last_year = {};
            let espn_projections = {};

            // target the table rows that hold the stats and loop through each row
            let stats_tables = element.querySelectorAll('.Table2__tr');
            for (var stat_table of stats_tables) {

                // grab the idx data element to decipher if it's 2018 history or 2019 projection
                let data_index = stat_table.getAttribute('data-idx');

                // target the table cells that hold the stats and loop through each cell
                let stats = stat_table.querySelectorAll('div.table--cell');
                for(var stat of stats) {

                    // pull the cell title and value
                    let label = stat.title || 'year';
                    let value = stat.textContent;

                    // if the data-idx value is 0 it's the first row, so it's 'last_year' else if it's 1 then it's the projections
                    // a table cell from a different table shows up in this loop, so we add '&& label !== "Rank"' to omit it
                    if(data_index === "0" && label !== "Rank"){
                        last_year[label] = value;
                    } else if(data_index === "1") {
                        espn_projections[label] = value;
                    }
                }
            }

            // push and object to the return data
            // the object is in the format that it will go into the 
            // this is using ES2015 shorthand property names: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#Property_definitions
            data.push({ clean_name, name, position, team, espn_rank, last_year, espn_projections });
        }

        return data;
    });
}

// initiate the scrape
scrape().then(results => {
    // connect to the database
    client.connect(err => {
        // create a reference to the collection
        const collection = client.db("fancy-garbanzo").collection("players");
        // insert all of the results
        collection.insertMany(results);
        // close the connection to the client
        client.close();
    });
});
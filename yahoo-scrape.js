// npm install puppeteer mongodb --save
const puppeteer = require('puppeteer');
const keys = require('./keys');
const MongoClient = require('mongodb').MongoClient;
const uri = keys.MONGODBURI;
const client = new MongoClient(uri, { useNewUrlParser: true });

// here is our main scrape function
const scrape = async () => {
    
    // set up our puppeteer scrape
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768});

    
    // request the URL: "https://football.fantasysports.yahoo.com/f1/800349/players"
    await page.goto('https://football.fantasysports.yahoo.com/f1/800349/players', { waitUntil: 'networkidle0' });

    // login:
    // Username in "#login-username"
    await page.type('#login-username', keys.YAHOO_USER);

    // wait for and then click "#login-signin"
    await page.waitFor('#login-signin');
    await Promise.all([
        page.click('#login-signin'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);
    
    // password:
    // pasword in "#login-passwd"
    await page.type('#login-passwd', keys.YAHOO_PASS);
    // wait for and then click "#login-signin"
    await page.waitFor('#login-signin');
    await Promise.all([
        page.click('#login-signin'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    // choose 2019 projections 
    // "select#statselect"
    // option value = "S_PSR_2019"
    await page.waitFor('#statselect');
    await Promise.all([
        page.select('#statselect', 'S_PSR_2019'),
        page.click('input[value="Filter"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);
    
    // await page.screenshot({path: './yahoo-screenshot.png'});
    
    // set-up array that will hold the results
    var results = [];

    // need to loop through each page
    // currently this URL has 25 players on each page and 12 pages (with valid data)
    // create variable to hold the number of pages
    // for yahoo I think there are ... 
    var lastPageNumber = 15;
    
    // you are on page one when the script starts
    // create a loop that starts at one and ends at the last page
    for (let i = 1; i < lastPageNumber + 1; i++) {
        console.log("we on page: ", i);
        // give the site a second to load
        await page.waitFor(1000);
        
        // concat the results of your extracted data to the existing results
        // SEE extractedEvaluateCall below...

        results = results.concat(await extractedEvaluateCall(page));

        // as long as it's not the last page then click the arrow to go to the next page
        console.log(i, " vs ", lastPageNumber);
        if (i != lastPageNumber) {
            await Promise.all([
                page.click('li.last.Inlineblock'),
                page.waitForNavigation({ waitUntil: 'networkidle0' })
            ]);
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

        // target each player row
        let players_table = document.querySelector('#players-table');
        let players_table_body = players_table.querySelector('tbody');
        let elements = players_table_body.querySelectorAll('tr');

        // loop through the rows
        for (var element of elements) {

            // grab the name, url, position with team, and rank
            let name = element.querySelector('.ysf-player-name').childNodes[0].textContent;
            let yahoo_url = element.querySelector('.ysf-player-name').childNodes[0].href;
            let team_position = element.querySelector('.ysf-player-name').childNodes[2].textContent;            
            let yahoo_rank = element.childNodes[9].childNodes[0].textContent;

            // clean and normalize the data
            name = name.trim();
            let team_position_array = team_position.split(" - ")
            position = team_position_array[1].trim().toLowerCase();
            team = team_position_array[0].trim().toLowerCase();
            yahoo_rank = parseInt(yahoo_rank.trim());

            // create a unique string that could be used as a key later
            let clean_name = name.replace(/\.?([A-Z]+)/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "").replace(/\s/g, "").replace(".", "");

            // create object to hold the projections
            let yahoo_projections = {
                "Fantasy_Points": parseFloat(element.childNodes[7].childNodes[0].textContent),
                "Pass_Comp": parseFloat(element.childNodes[11].childNodes[0].textContent),
                "Pass_Yds": parseFloat(element.childNodes[12].childNodes[0].textContent),
                "Pass_TD": parseFloat(element.childNodes[13].childNodes[0].textContent),
                "Pass_Int": parseFloat(element.childNodes[14].childNodes[0].textContent),
                "Pass_40_Yd_Cmp": parseFloat(element.childNodes[15].childNodes[0].textContent),
                "Rush_Att": parseFloat(element.childNodes[16].childNodes[0].textContent),
                "Rush_Yds": parseFloat(element.childNodes[17].childNodes[0].textContent),
                "Rush_TD": parseFloat(element.childNodes[18].childNodes[0].textContent),
                "Rush_40_Yd_Att": parseFloat(element.childNodes[19].childNodes[0].textContent),
                "Rush_40_Yd_TD": parseFloat(element.childNodes[20].childNodes[0].textContent),
                "Rec_Tgt": parseFloat(element.childNodes[21].childNodes[0].textContent),
                "Rec_Rec": parseFloat(element.childNodes[22].childNodes[0].textContent),
                "Rec_Yds": parseFloat(element.childNodes[23].childNodes[0].textContent),
                "Rec_TD": parseFloat(element.childNodes[24].childNodes[0].textContent),
                "Rec_40_Yd_Rec": parseFloat(element.childNodes[25].childNodes[0].textContent),
                "Misc_2PT": parseFloat(element.childNodes[26].childNodes[0].textContent),
                "Fum_Tot": parseFloat(element.childNodes[27].childNodes[0].textContent),
                "Fum_Lost": parseFloat(element.childNodes[28].childNodes[0].textContent)
            };

            // push the player object to the return data
            // the object is in the format that it will go into the db
            // this is using ES2015 shorthand property names: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#Property_definitions
            if(yahoo_projections.Fantasy_Points > 0) {
                data.push({ clean_name, name, team, position, yahoo_url, yahoo_rank, yahoo_projections });
            }
            
        }

        console.log("data (after): ", data);
        return data;
    });
}

// initiate the scrape
scrape()
.then(results => {
    console.log(results);
    // connect to the database
    client.connect(err => {
        // create a reference to the collection
        const collection = client.db("fancy-garbanzo").collection("players");
        // insert all of the results
        collection.insertMany(results)
        .then(() => {
            // close the connection to the client
            client.close();
            process.exit(1);
        });
        
    });
    
})
.catch(err => console.log(err));
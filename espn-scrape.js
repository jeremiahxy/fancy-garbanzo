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
    var lastPageNumber = 12;

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
            let full_name = element.querySelector('.link.pointer').textContent;            
            let position = element.querySelector('.playerinfo__playerpos').textContent;
            let team = element.querySelector('.pro-team-name').textContent;            
            let espn_rank = element.querySelector('.playerInfo__rank.Table2__td').childNodes[0].textContent;
            let headshot_url = element.querySelector('.player-headshot.projection-player-headshot').childNodes[0].src;
            
            // clean and normalize the data
            full_name = full_name.trim();
            position = position.trim().toLowerCase();
            team = team.trim().toLowerCase();
            espn_rank = parseInt(espn_rank.trim());

            // create name string to be used for matching existing player
            let nameArray = full_name.split(" ");
            let firstInitial = nameArray[0][0];
            nameArray[0] = firstInitial;
            let name = nameArray.join(" ");
            let clean_name = name.replace(/\.?([A-Z]+)/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "").replace(/ /g, "");
            let full_clean_name = full_name.replace(/\.?([A-Z]+)/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "").replace(/ /g, "");

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
                        switch (label) {
                            case "Each Pass Completed & Each Pass Attempted":
                                let valueArray = value.split("/");
                                last_year["Pass_Comp"] = parseFloat(valueArray[0]);
                                break;
                            case "Fantasy Points":
                                last_year["Fantasy_Points"] = parseFloat(value);
                                break;
                            case "Passing Yards":
                                last_year["Pass_Yds"] = parseFloat(value);
                                break;
                            case "TD Pass":
                                last_year["Pass_TD"] = parseFloat(value);
                                break;
                            case "Interceptions Thrown":
                                last_year["Pass_Int"] = parseFloat(value);
                                break;
                            case "Rushing Attempts":
                                last_year["Rush_Att"] = parseFloat(value);
                                break;
                            case "Rushing Yards":
                                last_year["Rush_Yds"] = parseFloat(value);
                                break;
                            case "TD Rush":
                                last_year["Rush_TD"] = parseFloat(value);
                                break;
                            case "Receiving Target":
                                last_year["Rec_Tgt"] = parseFloat(value);
                                break;
                            case "Each reception":
                                last_year["Rec_Rec"] = parseFloat(value);
                                break;
                            case "Receiving Yards":
                                last_year["Rec_Yds"] = parseFloat(value);
                                break;
                            case "TD Reception":
                                last_year["Rec_TD"] = parseFloat(value);
                                break;
                            default:
                                last_year[label] = value;
                                break;
                        }
                    } else if(data_index === "1") {
                        switch (label) {
                            case "Each Pass Completed & Each Pass Attempted":
                                let valueArray = value.split("/");
                                espn_projections["Pass_Comp"] = parseFloat(valueArray[0]);
                                break;
                            case "Fantasy Points":
                                espn_projections["Fantasy_Points"] = parseFloat(value);
                                break;
                            case "Passing Yards":
                                espn_projections["Pass_Yds"] = parseFloat(value);
                                break;
                            case "TD Pass":
                                espn_projections["Pass_TD"] = parseFloat(value);
                                break;
                            case "Interceptions Thrown":
                                espn_projections["Pass_Int"] = parseFloat(value);
                                break;
                            case "Rushing Attempts":
                                espn_projections["Rush_Att"] = parseFloat(value);
                                break;
                            case "Rushing Yards":
                                espn_projections["Rush_Yds"] = parseFloat(value);
                                break;
                            case "TD Rush":
                                espn_projections["Rush_TD"] = parseFloat(value);
                                break;
                            case "Receiving Target":
                                espn_projections["Rec_Tgt"] = parseFloat(value);
                                break;
                            case "Each reception":
                                espn_projections["Rec_Rec"] = parseFloat(value);
                                break;
                            case "Receiving Yards":
                                espn_projections["Rec_Yds"] = parseFloat(value);
                                break;
                            case "TD Reception":
                                espn_projections["Rec_TD"] = parseFloat(value);
                                break;
                            default:
                                espn_projections[label] = value;
                                break;
                        }
                    }
                }
            }

            // push and object to the return data
            // the object is in the format that it will go into the 
            // this is using ES2015 shorthand property names: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#Property_definitions
            if(espn_projections.Fantasy_Points > 0) {
                data.push([{ 
                    clean_name,
                    team,
                    position,
                },{
                    clean_name,
                    team,
                    position,
                    full_name,
                    headshot_url,
                    espn_rank,
                    last_year,
                    espn_projections
                }]);
            }
        }

        return data;
    });
}

function updateDatabase(players, array) {
    return new Promise((resolve, reject) => {
        
        function syncronousAddToDatabase(i) {
            let options = { upsert: true }
            if (i >= array.length) {
                resolve();
            } else {
                players.updateOne(array[i][0], { $set: array[i][1] }, options)
                .then(function () { 
                    syncronousAddToDatabase(i + 1); 
                })
                .catch(function (error) { 
                    console.log(error); 
                    syncronousAddToDatabase(i + 1);
                });
            }
        }

        syncronousAddToDatabase(0);
    })
}

// initiate the scrape
scrape().then(results => {
    console.log(results[0][0]);
    console.log(results[0][1].espn_projections);
    // connect to the database
    client.connect(err => {
        // create a reference to the collection
        const players = client.db("fancy-garbanzo").collection("players");

        // update the database with all of the results
        updateDatabase(players, results)
        .then(() => {
            console.log("everything updated");
            // close the connection to the db
            client.close();
            // exit the node script
            process.exit(1);
        })
        .catch(err => {
            console.log(err);
            // close the connection to the db
            client.close();
            // exit the node script
            process.exit(1);
        });

    });
    
})
.catch(err => console.log(err));
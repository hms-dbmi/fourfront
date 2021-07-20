

describe('Deployment/CI Search View Tests', function () {

    var testItemsToDelete = [];

    function addAtIdToDeletedItems() {
        cy.get('script[data-prop-name=context]').wait(1000).then(function ($context) {
            const context = $context.text();
            const contextData = JSON.parse(context);
            const atId = contextData['@id'];
            console.log('DELETING atId', atId);
            testItemsToDelete.push(atId);
        });
    }

    context('/search/?type=Item', function () {

        before(function(){ // beforeAll
            cy.visit('/search/');
        });

        it('Has at least 100 results for /search/?type=Item', function () {
            cy.location('search').should('include', 'type=Item').end()
                .get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                    expect($searchResultElems.length).to.equal(25);
                }).end()
                .searchPageTotalResultCount().should('be.greaterThan', 100);
        });

    });

    context('/search/?type=Page', function(){

        before(function(){ // beforeAll
            cy.visit('/pages'); // We should get redirected to ?type=Page
        });

        beforeEach(function(){
            // Ensure we preserve search session cookie for proper ordering.
            Cypress.Cookies.preserveOnce("searchSessionID");
        });

        it('Should redirect to /search/?type=Page correctly', function(){
            cy.location('search').should('include', 'type=Page').end()
                .location('pathname').should('include', '/search/');
        });

        it('Should have at least 20 results.', function(){
            cy.get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                expect($searchResultElems.length).to.be.greaterThan(20);
            });
        });

    });

    context('Publications, Files, Microscope Configurations Collections', function(){
        // These are similarly implemently to the BrowseView, we should have specific tests for these

        it('/publications/ should redirect to /search/?type=Publication', function(){
            cy.visit('/publications/').location('search').should('include', 'type=Publication').end()
                .location('pathname').should('include', '/search/');
        });

        it('Should have at least 3 Publications.', function(){
            cy.get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                expect($searchResultElems.length).to.be.greaterThan(2);
            });
            cy.get('.search-results-container .search-result-row .toggle-detail-button-container').then(($searchResultToggleBtnElems)=>{
                expect($searchResultToggleBtnElems.length).to.be.greaterThan(2);
            });
        });

        it('/files/ should redirect to /search/?type=File', function(){
            cy.visit('/files/').location('search').should('include', 'type=File').end()
                .location('pathname').should('include', '/search/');
        });

        it('Should have at least 20 File row selection checkboxes', function(){
            cy.get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                expect($searchResultElems.length).to.be.greaterThan(20);
            });
            cy.get('.search-results-container .search-result-row .checkbox-with-label.expset-checkbox input').then(($checkboxes)=>{
                expect($checkboxes.length).to.be.greaterThan(20);
            });
        });

        it('Should have columns for file type, format', function(){
            cy.get('.headers-columns-overflow-container .columns .search-headers-column-block[data-field="file_type"]').contains("File Type");
            cy.get('.headers-columns-overflow-container .columns .search-headers-column-block[data-field="file_format.file_format"]').contains("File Format");
        });

        // TODO test facets

        // it('/microscope-configurations/ should redirect to /search/?type=MicroscopeConfiguration', function(){
        //     cy.visit('/microscope-configurations/').location('search').should('include', 'type=MicroscopeConfiguration').end()
        //         .location('pathname').should('include', '/search/');
        // });
        let microscopeDescription;
        const standType = "Inverted";

        it('Can add new tier-1 microscope configuration', function(){

            cy.login4DN({ 'email' : '4dndcic@gmail.com', 'useEnvToken' : false }).end()
                .visit('/search/?type=MicroscopeConfiguration').end()
                .get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                    expect($searchResultElems.length).to.be.greaterThan(0);
                }).end()
                .get('.above-results-table-row .results-count.box button.btn-xs').contains("Create New Configuration").click().end().wait(1000)
                .get('a.dropdown-item').contains('Tier 1').click().end();

            // set microscope conf. name
            const identifier = ("mc-test-" + new Date().getTime());
            cy.get('.modal-dialog input#microscope_name.form-control').focus().type(identifier).wait(100).end();

            // set microscope conf. description
            microscopeDescription = "tier-1 microscope conf. description";
            cy.get('.modal-dialog input#microscope_description.form-control').focus().type(microscopeDescription).wait(100).end();

            // set microscope conf. stand type
            cy.get('button#validation_tier.dropdown-toggle.btn.btn-primary').contains('Select Stand Type').click().end().wait(1000)
                .get('a.dropdown-item').contains(standType).click().end().wait(1000);

            // submit new microscope conf. creation
            cy.get('button.btn.btn-success').contains('Submit').click().end().wait(1000);

            // get response and store atId (to delete item at the end of test)
            addAtIdToDeletedItems();
        });

        it('Verify created microscope\'s tier number and stand matches', function (){
            //Click edit buttton
            cy.get('div.micrometa-container #microscopy-app-container .btn.btn-primary.btn-lg').should('contain', 'Edit microscope').first().click().end().wait(1000);

            //Verify tier is 1
            cy.get('div.form-group div.mb-0.form-group input#rjsfPrefix_Tier').should('have.value', '1');

            //Verify stand
            cy.get('li#react-tabs-2').contains(standType + 'MicroscopeStand');

            //Edit popup cancel
            cy.get('div.form-group div.mb-0.form-group input#rjsfPrefix_Description').should('have.value', microscopeDescription)
                .get('div#microscopy-app-overlays-container div div div div button.btn.btn.btn-primary.btn-lg').contains('Cancel').click().end();
        });

        it('Can save as microscope configuration', function () {
            cy.login4DN({ 'email': '4dndcic@gmail.com', 'useEnvToken': true }).wait(1000);

            //Clone microscope data
            cy.get("div.dropup button#dropdown-basic-button.dropdown-toggle.btn.btn-dark.btn-lg div").contains('Save').click().wait(1000).end()
                //Clone success save message
                // eslint-disable-next-line no-useless-escape
                .get("a#Save\\ as\\ new\\ microscope.dropdown-item").click().wait(1000).get('h4.alert-heading.mt-0.mb-05').should('contain.text', "'s copy").end().wait(1000);

            // get response and store atId (to delete item at the end of test)
            addAtIdToDeletedItems();
        });

        it('Delete microscope configuration', function () {

            // Log in _as admin_.
            cy.login4DN({ 'email': '4dndcic@gmail.com', 'useEnvToken': true }).wait(1000);

            // Delete microscope configuration
            cy.wrap(testItemsToDelete).each(function (testItemURL) { // Synchronously process async stuff.
                console.log('DELETING', testItemURL);
                cy.getCookie('jwtToken')
                    .then((cookie) => {
                        const token = cookie.value;
                        cy.request({
                            method: "DELETE",
                            url: testItemURL,
                            headers: {
                                'Authorization': 'Bearer ' + token,
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            }
                        }).end().request({
                            method: "PATCH",
                            url: testItemURL,
                            headers: {
                                'Authorization': 'Bearer ' + token,
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            },
                            body: JSON.stringify({ "tags": ["deleted_by_cypress_test"] })
                        });
                    });
            });

            // Empty the array now that we're done.
            testItemsToDelete = [];
        });
    });

    context('Search Box in Navigation', function(){

        before(function(){ // beforeAll
            cy.visit('/'); // Start at home page
        });

        beforeEach(function(){
            // Ensure we preserve search session cookie for proper ordering.
            Cypress.Cookies.preserveOnce("searchSessionID");
        });

        it('SearchBox input works, goes to /browse/ on submit', function(){
            cy.get('input[name="q"]').focus().type('mouse').wait(10).end()
                .get('form.navbar-search-form-container').submit().end()
                .wait(300).get('#slow-load-container').should('not.have.class', 'visible').end()
                .get('#page-title-container .page-title').should('contain', 'Data Browser').end() // Make sure we got redirected to /browse/. We may or may not have results here depending on if on local and logged out or not.
                .location('search')
                .should('include', 'ExperimentSetReplicate')
                .should('include', 'q=mouse');
        });

        it('"All Items" option works, takes us to search page', function(){
            cy.get('form.navbar-search-form-container button#search-item-type-selector').click().wait(100).end()
                .get('form.navbar-search-form-container div.dropdown-menu a[data-key="all"]').click().end()
                .get('form.navbar-search-form-container').submit().end()
                .get('#page-title-container .page-title').should('contain', 'Search').end()
                .location('search').should('not.include', 'award.project=4DN')
                .should('include', 'q=mouse').end()
                .searchPageTotalResultCount().should('be.greaterThan', 0);
        });

        it('Clear search button works ==> more results', function(){
            cy.searchPageTotalResultCount().then((origTotalResults)=>{
                cy.get('form.navbar-search-form-container .reset-button').click().end()
                    .wait(1200).get('#slow-load-container').should('not.have.class', 'visible').end()
                    .searchPageTotalResultCount().should('be.greaterThan', origTotalResults);
            });
        });

        it('Wildcard query string returns all results.', function(){
            cy.window().screenshot('Before text search "*"').end().searchPageTotalResultCount().then((origTotalResults)=>{
                cy.get('#top-nav input[name="q"]').focus().clear().type('*').wait(10).end()
                    .get('form.navbar-search-form-container').submit().end()
                    .get('form.navbar-search-form-container button#search-item-type-selector').click().wait(100).end()
                    .get('form.navbar-search-form-container div.dropdown-menu a[data-key="all"]').click().end()
                    .get('form.navbar-search-form-container').submit().end()
                    // handle url encoding
                    .location('search').should('include', '%2A').wait(300).end()
                    .get('#slow-load-container').should('not.have.class', 'visible').end()
                    .searchPageTotalResultCount().should('be.greaterThan', 1).should('equal', origTotalResults).end().window().screenshot('After text search "*"').end();
            });
        });


    });

});

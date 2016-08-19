'use strict';
var React = require('react');
var url = require('url');
var Login = require('./login');
var {Navbars, Navbar, Nav, NavItem} = require('../libs/bootstrap/navbar');
var {DropdownMenu} = require('../libs/bootstrap/dropdown-menu');
var productionHost = require('./globals').productionHost;
var _ = require('underscore');


var Navigation = module.exports = React.createClass({
    mixins: [Navbars],

    contextTypes: {
        location_href: React.PropTypes.string,
        portal: React.PropTypes.object
    },

    getInitialState: function() {
        return {
            testWarning: !productionHost[url.parse(this.context.location_href).hostname]
        };
    },

    handleClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove the warning banner because the user clicked the close icon
        this.setState({testWarning: false});

        // If collection with .sticky-header on page, jiggle scroll position
        // to force the sticky header to jump to the top of the page.
        var hdrs = document.getElementsByClassName('sticky-header');
        if (hdrs.length) {
            window.scrollBy(0,-1);
            window.scrollBy(0,1);
        }
    },

    render: function() {
        var portal = this.context.portal;
        var img = <img src="/static/img/4dn_logo.svg" height= "70px" width="238px" className="nav-img"/>
        return (
            <div id="navbar" className="navbar navbar-fixed-top navbar-inverse">
                <div className="container">
                    <Navbar brand={img} brandlink="/" label="main" navClasses="navbar-main" navID="navbar-icon">
                        <GlobalSections />
                        <UserActions />
                        <Search />
                    </Navbar>
                </div>
                {this.state.testWarning ?
                    <div className="test-warning">
                        <div className="container">
                            <p>
                                The data displayed on this page is not official and only for testing purposes.
                                <a href="#" className="test-warning-close icon icon-times-circle-o" onClick={this.handleClick}></a>
                            </p>
                        </div>
                    </div>
                : null}
            </div>
        );
    }
});


// Main navigation menus
var GlobalSections = React.createClass({
    contextTypes: {
        listActionsFor: React.PropTypes.func,
    },
    render: function() {
        var actions = this.context.listActionsFor('global_sections').map(action => {
            return (
                <NavItem key={action.id} dropdownId={action.id} dropdownTitle={action.title} dropdownSId={action.sid} >
                    {action.children ?
                        <DropdownMenu label={action.id}>
                            {action.children.map(function(action){
                                return(
                                    <a href={action.url || ''} key={action.id} className="global-entry">
                                        {action.title}
                                    </a>
                                );
                            })}
                        </DropdownMenu>
                    : null}
                </NavItem>
            );
        });
        return <Nav>{actions}</Nav>;
    }
});


// Context actions: mainly for editing the current object
var ContextActions = React.createClass({
    contextTypes: {
        listActionsFor: React.PropTypes.func
    },

    render: function() {
        var actions = this.context.listActionsFor('context').map(function(action) {
            return (
                <div>
                    <a href={action.href} key={action.name} className="global-entry">
                        <i className="icon icon-pencil"></i> {action.title}
                    </a>
                </div>
            );
        });

        if (actions.length === 0) {
            // No actions
            return(<a href="#" className="invis"/>);
        }

        return (<div className="custom-entry">{actions}</div>);
    }
});

var Search = React.createClass({
    contextTypes: {
        location_href: React.PropTypes.string
    },

    render: function() {
        var id = url.parse(this.context.location_href, true);
        var searchTerm = id.query['searchTerm'] || '';
        return (
            <form className="navbar-form navbar-right" action="/search/">
                <input className="form-control search-query" id="navbar-search" type="text" placeholder="Search..."
                    ref="searchTerm" name="searchTerm" defaultValue={searchTerm} key={searchTerm} />
            </form>
        );
    }
});


var UserActions = React.createClass({
    contextTypes: {
        listActionsFor: React.PropTypes.func,
        session_properties: React.PropTypes.object
    },

    render: function() {
        var session_properties = this.context.session_properties;
        var actions = this.context.listActionsFor('user_section').map(function (action) {
            if (action.id === "login"){
                return(<Login />);
            }else if (action.id === "profile"){
                return(<AccountActions/>);
            }else if (action.id === "contextactions") {
                return(<ContextActions/>);
            }else{
                return(
                        <a href={action.href || ''} key={action.id} data-bypass={action.bypass} data-trigger={action.trigger} className="global-entry">
                            {action.title}
                        </a>
                    );
            }
        });
        var active_icon;
        if (session_properties['auth.userid']) {
            active_icon = <img src="/static/img/User_active.svg" height= "30px" width="25px"/>
        }else{
            active_icon = <img src="/static/img/User_inactive.svg" height= "30px" width="25px"/>
        }
        return (
                <Nav right={true} acct={true}>
                    <NavItem dropdownId="context" dropdownTitle={active_icon}>
                        <DropdownMenu label="context">
                            {actions}
                        </DropdownMenu>
                    </NavItem>
                </Nav>
        );
    }
});

var AccountActions = React.createClass({
    contextTypes: {
        listActionsFor: React.PropTypes.func,
        session_properties: React.PropTypes.object
    },

    render: function() {
        var session_properties = this.context.session_properties;
        if (!session_properties['auth.userid']) {
            // Logged out, so no user menu at all
            return(<a href="#" className="invis"/>);
        }
        var actions = this.context.listActionsFor('user').map(function (action) {
            return (
                <div>
                    <a href={action.href || ''} key={action.id} data-bypass={action.bypass} data-trigger={action.trigger} className="global-entry">
                        {action.title}
                    </a>
                </div>
            );
        });
        return (
            <div className="custom-entry">{actions}</div>
        );
    }
});

// Display breadcrumbs with contents given in 'crumbs' object.
// Each crumb in the crumbs array: {
//     id: Title string to display in each breadcrumb. If falsy, does not get included, not even as an empty breadcrumb
//     query: query string property and value, or null to display unlinked id
//     uri: Alternative to 'query' property. Specify the complete URI instead of accreting query string variables
//     tip: Text to display as part of uri tooltip.
//     wholeTip: Alternative to 'tip' property. The complete tooltip to display
// }
var Breadcrumbs = module.exports.Breadcrumbs = React.createClass({
    propTypes: {
        root: React.PropTypes.string, // Root URI for searches
        crumbs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired // Object with breadcrumb contents
    },

    render: function() {
        var accretingQuery = '';
        var accretingTip = '';

        // Get an array of just the crumbs with something in their id
        var crumbs = _.filter(this.props.crumbs, function(crumb) { return crumb.id; });
        var rootTitle = crumbs[0].id;

        return (
            <ol className="breadcrumb">
                {crumbs.map((crumb, i) => {
                    // Build up the query string if not specified completely
                    if (!crumb.uri) {
                        accretingQuery += crumb.query ? '&' + crumb.query : '';
                    }

                    // Build up tooltip if not specified completely
                    if (!crumb.wholeTip) {
                        accretingTip += crumb.tip ? (accretingTip.length ? ' and ' : '') + crumb.tip : '';
                    }

                    // Render the breadcrumbs
                    return (
                        <li key={i}>
                            {(crumb.query || crumb.uri) ? <a href={crumb.uri ? crumb.uri : this.props.root + accretingQuery} title={crumb.wholeTip ? crumb.wholeTip : 'Search for ' + accretingTip + ' in ' + rootTitle}>{crumb.id}</a> : <span>{crumb.id}</span>}
                        </li>
                    );
                })}
            </ol>
        );
    }
});

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { console, ajax, layout, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export class BigDropdownPageLoader extends React.PureComponent {

    static defaultProps = {
        'treeURL': '/pages/311d0f4f-56ee-4450-8cbb-780c10229284/@@embedded',
        'session': false
    };

    constructor(props){
        super(props);
        this.loadPage = this.loadPage.bind(this);
        this.state = {
            'menuTree': null,
            'isLoadingMenuTree': false
        };
    }

    componentDidMount(){
        const { menuTree, isLoadingMenuTree } = this.state;
        if (!menuTree && !isLoadingMenuTree){
            this.loadPage();
        }
    }

    componentDidUpdate(prevProps, prevState){
        const { session } = this.props;
        if (session !== prevProps.session){
            this.loadPage();
        }
    }

    /**
     * Performs AJAX request to `props.treeURL` and saves response to
     * `state.menuTree`. Manages `state.isLoadingMenuTree` appropriately.
     */
    loadPage(){
        const { isLoadingMenuTree } = this.state;
        const { treeURL } = this.props;
        if (isLoadingMenuTree) {
            logger.error("Already loading Help tree");
            return;
        }
        this.setState({ 'isLoadingMenuTree' : true }, ()=>{
            ajax.load(treeURL, (res)=>{
                if (res && res.name){
                    this.setState({ 'menuTree' : res, 'isLoadingMenuTree' : false });
                } else {
                    this.setState({ 'menuTree' : null, 'isLoadingMenuTree' : false });
                }
            }, 'GET', ()=>{
                this.setState({ 'menuTree' : null, 'isLoadingMenuTree' : false });
            });
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const childProps = { ...passProps, ...this.state };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}

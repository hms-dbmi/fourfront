'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import Carousel from 'nuka-carousel';
import { console, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

export class PageCarousel extends React.PureComponent {

    static defaultProps = {
        'slides': [
            {
                'img': 'https://s3.amazonaws.com/4dn-dcic-public/static-pages/carousel-images/Survey2-4.png',
                'description': 'In less than 60 seconds, you can provide feedback on your data portal experience.',
                'title': 'We are listening!',
                'badge': null,
                'badgeBgColor': null,
                'link': 'https://goo.gl/forms/IQeOkONbeP9QsfzU2'
            },
            {
                'img': 'https://s3.amazonaws.com/4dn-dcic-public/static-pages/carousel-images/jupyterhub_w_border.png',
                'description': 'The new Jupyter Notebook Service for registered users provides immediate access to all 4DN data.',
                'title': '4DN JupyterHub',
                'badge': 'BETA',
                'badgeBgColor': null,
                'link': '/jupyterhub'
            },
            {
                'img': 'https://s3.amazonaws.com/4dn-dcic-public/static-pages/carousel-images/carousel-higlass.png',
                'description': 'Powered by HiGlass.',
                'title': '4DN Visualization Workspace',
                'badge': 'BETA',
                'badgeBgColor': null,
                'link': '/visualization/index'
            },
            {
                'img': 'https://s3.amazonaws.com/4dn-dcic-public/static-pages/carousel-images/heterogeneitypublicationfigures.png',
                'description': 'Finn et. al. utilize high throughput imaging to study heterogeneity in 3D genome structure.',
                'title': 'Data Highlight',
                'badge': null,
                'badgeBgColor': null,
                'link': '/publications/80007b23-7748-4492-9e49-c38400acbe60/'
            }
        ],
        'slidesToShow': 3, //integer: Number of slides to show at once
        'slidesToScroll': 1, //integer: Slides to scroll at once
        'slideIndex': 0, //integer: the index of the slide to be shown
        'autoPlay': false, //bool: starts slide show automatically. not working yet due to a bug.
        'pauseOnHover': true,
        'wrapAround': true,
        'dragging': false,
        'navControlPosition': 'outside', //left and right nav controls position. Possible values: 'outside' or 'inside'
        'slideHeight': 240, //integer: Slide height in px. If not defined default is 240.
        //'adjustImageHeight': true, //boolean: if true, resizes slide image's height to container. best for single display power point slides, otherwise set it as false (recommended)
        'showSlideCount': true, //boolean: displays [Slide x of n] at the bottom left corner. Valid if slidesToShow is defined as 1
        //'textPosition': 'bottom', //'bottom/top/left/right': position of title & description on slide
    };

    static propTypes = {
        'slides': PropTypes.array.isRequired,
        'slidesToShow': PropTypes.number.isRequired,
        'slidesToScroll': PropTypes.number.isRequired,
        'slideIndex': PropTypes.number.isRequired,
        'autoPlay': PropTypes.bool.isRequired,
        'pauseOnHover': PropTypes.bool.isRequired,
        'dragging': PropTypes.bool.isRequired,
        'windowWidth': PropTypes.number,
        'navControlPosition': PropTypes.string,
        'slideHeight': PropTypes.number.isRequired,
        //'adjustImageHeight': PropTypes.bool.isRequired,
        'showSlideCount': PropTypes.bool.isRequired,
        //'textPosition': PropTypes.bool.isRequired,
    };

    constructor(props){
        super(props);
        this.renderSlide = this.renderSlide.bind(this);
    }

    static refFunc(elem) {
        setTimeout(() => {
            if (!elem) return;
            elem.style.opacity = 1;
        }, 10);
    }

    /**
     * this function renders a slide and customize it based on title/description/badge/link and image
     * @param {Object} slide    Carousel slide to be displayed
     */
    renderSlide(slide) {
        const { img, description, title, badge, badgeBgColor, link } = slide;
        const { slideHeight, adjustImageHeight, textPosition } = this.props;

        //todo: move css rules to _static-pages.scss after usability tests
        // let titleContainerStyle = null;
        // let badgeOuterStyle = null;
        // if (textPosition === 'bottom') {
        //     titleContainerStyle = { left: 0, right: 0, top: 'unset', bottom: 0 };
        //     badgeOuterStyle = { left: '10px', right: 'unset' };
        // } else if (textPosition === 'top') {
        //     titleContainerStyle = { left: 0, right: 0, top: 0, bottom: 'unset' };
        //     badgeOuterStyle = { left: 'unset', right: '10px' };
        // } else if (textPosition === 'left') {
        //     titleContainerStyle = { left: 0, right: 'unset', top: 0, bottom: 0, width: '35%' };
        //     badgeOuterStyle = { left: 'unset', right: '10px' };
        // } else if (textPosition === 'right') {
        //     titleContainerStyle = { left: 'unset', right: 0, top: 0, bottom: 0, width: '35%' };
        //     badgeOuterStyle = { left: '10px', right: 'unset' };
        // }
        const content = ((title || description) ?
            (
                <div className="title-container">
                    {title ? <h4 className="mt-0">{title}</h4> : null}
                    {description ? <p>{description}</p> : null}
                </div>
            ) : null);

        const containerStyle = { height: slideHeight };
        const badgeStyle = badgeBgColor ? { backgroundColor: badgeBgColor } : null;
        const innerFrame = (
            <div style={containerStyle}>
                <div className="inner-container" style={containerStyle}>
                    <div className="bg-image" style={img ? { 'backgroundImage': 'url(' + img + ')' } : null} />
                    {content}
                </div>
                <div className="inner-body">
                    {badge ?
                        <div className="inner-body">
                            <div className="slide-label" style={badgeStyle}>{badge}</div>
                        </div>
                        : null}
                </div>
            </div>
        );

        if (link) {
            const isExternalLink = link.slice(0, 4) === 'http';
            return (
                <a className="homepage-carousel-slide is-link" href={link} target={isExternalLink ? '_blank' : null} rel={isExternalLink ? 'noopener noreferrer' : null}>
                    {innerFrame}
                </a>
            );
        }

        return <div className="homepage-carousel-slide">{innerFrame}</div>;
    }

    render() {
        const { slides, slidesToShow, navControlPosition, slideHeight, adjustImageHeight, showSlideCount, textPosition, windowWidth } = this.props;

        const settings = _.extend({}, _.pick(this.props,
            'slidesToShow',
            'slidesToScroll',
            'slideIndex',
            'autoPlay',
            'pauseOnHover',
            'wrapAround',
            'dragging'
        ));

        //adjustments for responsive display
        const gridState = layout.responsiveGridState(windowWidth || null);
        if (gridState === 'sm' || gridState === 'md' || slides.length === 2) {
            settings.slidesToShow = Math.min(2, slidesToShow); // Don't increase if default for larger sizes is 1 already.
        } else if (gridState === 'xs' || slides.length === 1) {
            settings.slidesToShow = Math.min(1, slidesToShow);
        }

        const wrapperStyle = { opacity: 0 };

        // slide height
        if (slideHeight > 0) {
            settings.heightMode = "max";
            wrapperStyle.height = slideHeight + 30; // React automatically converts to px by default.
        } else {
            settings.heightMode = "max";
        }
        // slide count
        if ((showSlideCount === false) || (showSlideCount === true && slidesToShow > 1)) {
            settings.renderBottomLeftControls = null;
        } else {
            settings.renderBottomLeftControls = function ({ currentSlide, slideCount }) {
                return <div>Slide <strong>{currentSlide + 1}</strong> of <strong>{slideCount}</strong></div>;
            };
        }

        //left and right nav controls
        settings.renderCenterLeftControls = function ({ previousSlide, currentSlide }) {
            if (currentSlide === 0) return null;
            return <i className="icon icon-fw fas icon-angle-left icon-2x" onClick={previousSlide} />;
        };
        settings.renderCenterRightControls = function (sliderProps) {
            var { nextSlide, currentSlide, slideCount, slidesToShow } = sliderProps;
            if (currentSlide >= slideCount - slidesToShow) return null;
            return <i className="icon icon-fw fas icon-angle-right icon-2x" onClick={nextSlide} />;
        };

        const wrapperClass = 'homepage-carousel-wrapper' + (navControlPosition === 'inside' ? ' carousel-nav-inside' : '');
        return (
            <div className={wrapperClass} ref={PageCarousel.refFunc} style={wrapperStyle} key="carousel">
                <div className="container">
                    <div className="row">
                        <Carousel {...settings}>{ slides.map(this.renderSlide) }</Carousel>
                    </div>
                </div>
            </div>
        );
    }
}
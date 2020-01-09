import React, { useState, useEffect } from 'react';

import VectorGuides from '@site/src/components/VectorGuides';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

import animatedGraph from '@site/src/exports/animatedGraph';
import classnames from 'classnames';
import styles from './components.module.css';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

function Guides(props) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      let canvas = document.querySelector("canvas");
      let timer = animatedGraph(canvas);
      return () => {
        timer.stop();
      }
    }
  }, []);

  return (
    <Layout title="Guides" description="Browse and search all of Vector's guides. Filter by source and sink.">
      <header className={classnames('hero', styles.componentsHero)}>
        <div className="container container--fluid container--flush">
          <canvas width="2000" height="300"></canvas>
          <div className={styles.componentsHeroOverlay}>
            <h1>Vector Guides</h1>
            <div className="hero__subtitle">
              These guides are whack, yo.
            </div>
          </div>
        </div>
      </header>
      <main className="container container--fluid">
        <VectorGuides filterColumn={true} headingLevel={2} location={props.location} />
      </main>
    </Layout>
  );
}

export default Guides;

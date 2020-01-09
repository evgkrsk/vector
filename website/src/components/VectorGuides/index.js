import React, {useState} from 'react';

import CheckboxList from '@site/src/components/CheckboxList';
import Jump from '@site/src/components/Jump';
import Link from '@docusaurus/Link';

import _ from 'lodash';
import classnames from 'classnames';
import humanizeString from 'humanize-string';
import qs from 'qs';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import './styles.css';

function Guide({description, featured, title, name}) {
  let path = `/guides/${name}/`;
  return (
    <Link to={path} className="vector-component">
      <div className="vector-component--header">
        <div className="vector-component--name">{title}</div>
        <div className="vector-component--description">{description}</div>
      </div>
      <div className="vector-component--badges">
        { featured ?
          <span className="badge badge--warning" title="This guide has been generated"><i className="feather icon-alert-triangle"></i></span> :
          <span className="badge badge--primary" title="This guide is featured"><i className="feather icon-award"></i></span>}
      </div>
    </Link>
  );
}

function Guides({guides}) {
  return (
    <>
      <>
        <div className="vector-components--grid">
          {guides.map(guide => (
            <Guide {...guide} />
          ))}
        </div>
      </>
      <hr />
      <Jump to="https://github.com/timberio/vector/issues/new?labels=type%3A+new+feature" target="_blank" icon="plus-circle">
        Request a new guide
      </Jump>
    </>
  );
}

function VectorGuides(props) {
  //
  // Base Variables
  //

  const {siteConfig} = useDocusaurusContext();
  const filterColumn = props.filterColumn == true;
  const queryObj = props.location ? qs.parse(props.location.search, {ignoreQueryPrefix: true}) : {};

  let guides = [];

  guides.push({
    title: "Foo",
    name: "foo",
    featured: false,
    description: "this is an example guide"
  });
  guides.push({
    title: "Also",
    name: "also",
    featured: true,
    description: "this is an example guide"
  });

  guides = guides.sort((a, b) => (a.name > b.name) ? 1 : -1);

  //
  // State
  //

  const [onlyFeatured, setOnlyFeatured] = useState(queryObj['featured'] == 'true');
  const [searchTerm, setSearchTerm] = useState(null);

  //
  // Filtering
  //

  if (searchTerm) {
    guides = guides.filter(guide => {
      let fullName = guide.title.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase())
    });
  }

  if (onlyFeatured) {
    guides = guides.filter(guide => guide.featured);
  }

  //
  // Rendering
  //

  return (
    <div className={classnames('vector-components', {'vector-components--cols': filterColumn})}>
      <div className="filters">
        <div className="search">
          <input
            type="text"
            onChange={(event) => setSearchTerm(event.currentTarget.value)}
            placeholder="🔍 Search..." />
        </div>
        <div className="filter">
          <div className="filter--label">
            Guide types <i className="feather icon-info"></i>
          </div>
          <div className="filter--choices">
            <label title="Show only guides that are featured.">
              <input
                type="checkbox"
                onChange={(event) => setOnlyFeatured(event.currentTarget.checked)}
                checked={onlyFeatured} /> Featured
            </label>
          </div>
        </div>
      </div>
      <div className="vector-components--results">
        <Guides guides={guides} />
      </div>
    </div>
  );
}

export default VectorGuides;

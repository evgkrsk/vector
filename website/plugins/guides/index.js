/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs-extra');
const _ = require('lodash');
const path = require('path');
const {normalizeUrl, docuHash, aliasedSitePath} = require('@docusaurus/utils');

const {generateGuideFeed, generateGuidePosts} = require('./guideUtils');

const DEFAULT_OPTIONS = {
  path: 'guides', // Path to data on filesystem, relative to site dir.
  routeBasePath: 'guides', // URL Route.
  include: ['*.md', '*.mdx'], // Extensions to include.
  postsPerPage: 10, // How many posts per page.
  guideListComponent: '@theme/BlogListPage',
  guidePostComponent: '@theme/BlogPostPage',
  guideTagsListComponent: '@theme/BlogTagsListPage',
  guideTagsPostsComponent: '@theme/BlogTagsPostsPage',
  remarkPlugins: [],
  rehypePlugins: [],
  truncateMarker: /<!--\s*(truncate)\s*-->/, // string or regex
};

function assertFeedTypes(val) {
  if (typeof val !== 'string' && !['rss', 'atom', 'all'].includes(val)) {
    throw new Error(
      `Invalid feedOptions type: ${val}. It must be either 'rss', 'atom', or 'all'`,
    );
  }
}

const getFeedTypes = (type) => {
  assertFeedTypes(type);
  let feedTypes = [];

  if (type === 'all') {
    feedTypes = ['rss', 'atom'];
  } else {
    feedTypes.push(type);
  }
  return feedTypes;
};

module.exports = pluginContentGuide;

function pluginContentGuide(
  context,
  opts,
) {
  const options = {...DEFAULT_OPTIONS, ...opts};
  const {siteDir, generatedFilesDir} = context;
  const contentPath = path.resolve(siteDir, options.path);
  const dataDir = path.join(
    generatedFilesDir,
    'guides',
  );

  return {
    name: 'guides',

    getPathsToWatch() {
      const {include = []} = options;
      const globPattern = include.map(pattern => `${contentPath}/${pattern}`);
      return [...globPattern];
    },

    // Fetches guide contents and returns metadata for the necessary routes.
    async loadContent() {
      const {postsPerPage, routeBasePath} = options;

      const guidePosts = await generateGuidePosts(contentPath, context, options);
      if (!guidePosts) {
        return null;
      }

      // Colocate next and prev metadata
      guidePosts.forEach((guidePost, index) => {
        const prevItem = index > 0 ? guidePosts[index - 1] : null;
        if (prevItem) {
          guidePost.metadata.prevItem = {
            title: prevItem.metadata.title,
            permalink: prevItem.metadata.permalink,
          };
        }
        const nextItem =
          index < guidePosts.length - 1 ? guidePosts[index + 1] : null;
        if (nextItem) {
          guidePost.metadata.nextItem = {
            title: nextItem.metadata.title,
            permalink: nextItem.metadata.permalink,
          };
        }
      });

      // Guide pagination routes.
      // Example: `/guide`, `/guide/page/1`, `/guide/page/2`
      const totalCount = guidePosts.length;
      const numberOfPages = Math.ceil(totalCount / postsPerPage);
      const {
        siteConfig: {baseUrl = ''},
      } = context;
      const basePageUrl = normalizeUrl([baseUrl, routeBasePath]);

      const guideListPaginated = [];

      function guidePaginationPermalink(page) {
        return page > 0
          ? normalizeUrl([basePageUrl, `page/${page + 1}`])
          : basePageUrl;
      }

      for (let page = 0; page < numberOfPages; page += 1) {
        guideListPaginated.push({
          metadata: {
            permalink: guidePaginationPermalink(page),
            page: page + 1,
            postsPerPage,
            totalPages: numberOfPages,
            totalCount,
            previousPage: page !== 0 ? guidePaginationPermalink(page - 1) : null,
            nextPage:
              page < numberOfPages - 1
                ? guidePaginationPermalink(page + 1)
                : null,
          },
          items: guidePosts
            .slice(page * postsPerPage, (page + 1) * postsPerPage)
            .map(item => item.id),
        });
      }

      const guideTags = {};
      const tagsPath = normalizeUrl([basePageUrl, 'tags']);
      guidePosts.forEach(guidePost => {
        const {tags} = guidePost.metadata;
        if (!tags || tags.length === 0) {
          // TODO: Extract tags out into a separate plugin.
          // eslint-disable-next-line no-param-reassign
          guidePost.metadata.tags = [];
          return;
        }

        // eslint-disable-next-line no-param-reassign
        guidePost.metadata.tags = tags.map(tag => {
          if (typeof tag === 'string') {
            const normalizedTag = _.kebabCase(tag);
            const permalink = normalizeUrl([tagsPath, normalizedTag]);
            if (!guideTags[normalizedTag]) {
              guideTags[normalizedTag] = {
                name: tag.toLowerCase(), // Will only use the name of the first occurrence of the tag.
                items: [],
                permalink,
              };
            }

            guideTags[normalizedTag].items.push(guidePost.id);

            return {
              label: tag,
              permalink,
            };
          } else {
            return tag;
          }
        });
      });

      const guideTagsListPath =
        Object.keys(guideTags).length > 0 ? tagsPath : null;

      return {
        guidePosts,
        guideListPaginated,
        guideTags,
        guideTagsListPath,
      };
    },

    async contentLoaded({content, actions}) {
      if (!content) {
        return;
      }

      const {
        guideListComponent,
        guidePostComponent,
        guideTagsListComponent,
        guideTagsPostsComponent,
      } = options;

      const aliasedSource = (source) =>
        `~guide/${path.relative(dataDir, source)}`;
      const {addRoute, createData} = actions;
      const {
        guidePosts,
        guideListPaginated,
        guideTags,
        guideTagsListPath,
      } = content;

      const guideItemsToMetadata = {};

      // Create routes for guide entries.
      await Promise.all(
        guidePosts.map(async guidePost => {
          const {id, metadata} = guidePost;
          await createData(
            // Note that this created data path must be in sync with metadataPath provided to mdx-loader
            `${docuHash(metadata.source)}.json`,
            JSON.stringify(metadata, null, 2),
          );

          addRoute({
            path: metadata.permalink,
            component: guidePostComponent,
            exact: true,
            modules: {
              content: metadata.source,
            },
          });

          guideItemsToMetadata[id] = metadata;
        }),
      );

      // Create routes for guide's paginated list entries.
      await Promise.all(
        guideListPaginated.map(async listPage => {
          const {metadata, items} = listPage;
          const {permalink} = metadata;
          const pageMetadataPath = await createData(
            `${docuHash(permalink)}.json`,
            JSON.stringify(metadata, null, 2),
          );

          addRoute({
            path: permalink,
            component: guideListComponent,
            exact: true,
            modules: {
              items: items.map(postID => {
                const metadata = guideItemsToMetadata[postID];
                // To tell routes.js this is an import and not a nested object to recurse.
                return {
                  content: {
                    __import: true,
                    path: metadata.source,
                    query: {
                      truncated: true,
                    },
                  },
                };
              }),
              metadata: aliasedSource(pageMetadataPath),
            },
          });
        }),
      );

      // Tags.
      if (guideTagsListPath === null) {
        return;
      }

      const tagsModule = {};

      await Promise.all(
        Object.keys(guideTags).map(async tag => {
          const {name, items, permalink} = guideTags[tag];

          tagsModule[tag] = {
            allTagsPath: guideTagsListPath,
            slug: tag,
            name,
            count: items.length,
            permalink,
          };

          const tagsMetadataPath = await createData(
            `${docuHash(permalink)}.json`,
            JSON.stringify(tagsModule[tag], null, 2),
          );

          addRoute({
            path: permalink,
            component: guideTagsPostsComponent,
            exact: true,
            modules: {
              items: items.map(postID => {
                const metadata = guideItemsToMetadata[postID];
                return {
                  content: {
                    __import: true,
                    path: metadata.source,
                    query: {
                      truncated: true,
                    },
                  },
                };
              }),
              metadata: aliasedSource(tagsMetadataPath),
            },
          });
        }),
      );

      // Only create /tags page if there are tags.
      if (Object.keys(guideTags).length > 0) {
        const tagsListPath = await createData(
          `${docuHash(`${guideTagsListPath}-tags`)}.json`,
          JSON.stringify(tagsModule, null, 2),
        );

        addRoute({
          path: guideTagsListPath,
          component: guideTagsListComponent,
          exact: true,
          modules: {
            tags: aliasedSource(tagsListPath),
          },
        });
      }
    },

    configureWebpack(
      _config,
      isServer,
      {getBabelLoader, getCacheLoader},
    ) {
      const {rehypePlugins, remarkPlugins, truncateMarker} = options;
      return {
        resolve: {
          alias: {
            '~guide': dataDir,
          },
        },
        module: {
          rules: [
            {
              test: /(\.mdx?)$/,
              include: [contentPath],
              use: [
                getCacheLoader(isServer),
                getBabelLoader(isServer),
                {
                  loader: '@docusaurus/mdx-loader',
                  options: {
                    remarkPlugins,
                    rehypePlugins,
                    // Note that metadataPath must be the same/ in-sync as the path from createData for each MDX
                    metadataPath: (mdxPath) => {
                      const aliasedSource = aliasedSitePath(mdxPath, siteDir);
                      return path.join(
                        dataDir,
                        `${docuHash(aliasedSource)}.json`,
                      );
                    },
                  },
                },
                {
                  loader: path.resolve(__dirname, './markdownLoader.js'),
                  options: {
                    truncateMarker,
                  },
                },
              ].filter(Boolean),
            },
          ],
        },
      };
    },

    async postBuild({outDir}) {
      if (!options.feedOptions) {
        return;
      }

      const feed = await generateGuideFeed(context, options);

      if (!feed) {
        return;
      }

      const feedTypes = getFeedTypes((options.feedOptions || {}).type);

      await Promise.all(
        feedTypes.map(feedType => {
          const feedPath = path.join(
            outDir,
            options.routeBasePath,
            `${feedType}.xml`,
          );
          const feedContent = feedType === 'rss' ? feed.rss2() : feed.atom1();
          return fs.writeFile(feedPath, feedContent, err => {
            if (err) {
              throw new Error(`Generating ${feedType} feed failed: ${err}`);
            }
          });
        }),
      );
    },

    injectHtmlTags() {
      if (!options.feedOptions) {
        return {};
      }

      const feedTypes = getFeedTypes((options.feedOptions || {}).type);
      const {
        siteConfig: {title},
        baseUrl,
      } = context;
      const feedsConfig = {
        rss: {
          type: 'application/rss+xml',
          path: 'guide/rss.xml',
          title: `${title} Guide RSS Feed`,
        },
        atom: {
          type: 'application/atom+xml',
          path: 'guide/atom.xml',
          title: `${title} Guide Atom Feed`,
        },
      };
      const headTags = [];

      feedTypes.map(feedType => {
        const feedConfig = feedsConfig[feedType] || {};

        if (!feedsConfig) {
          return;
        }

        const {type, path, title} = feedConfig;

        headTags.push({
          tagName: 'link',
          attributes: {
            rel: 'alternate',
            type,
            href: normalizeUrl([baseUrl, path]),
            title,
          },
        });
      });

      return {
        headTags,
      };
    },
  };
}

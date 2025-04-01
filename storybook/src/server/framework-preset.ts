import { getSymfonyConfig, TwigComponentConfiguration, TwigConfiguration } from './lib/symfony';
import { StorybookConfig, SymfonyOptions } from '../types';
import { join } from 'path';
import { PreviewCompilerPlugin } from './lib/preview-compiler-plugin';
import { DevPreviewCompilerPlugin } from './lib/dev-preview-compiler-plugin';
import { TwigLoaderPlugin } from './lib/twig-loader-plugin';
import { PresetProperty } from '@storybook/types';
import dedent from 'ts-dedent';

type BuildOptions = {
    twigComponent: TwigComponentConfiguration;
    twig: TwigConfiguration;
    additionalWatchPaths: string[];
    projectPathAliases: {
        [p: string]: string;
    };
};

const getBuildOptions = async (symfonyOptions: SymfonyOptions) => {
    const symfonyConfig = await getSymfonyConfig(symfonyOptions.storybookCachePath);

    const componentNamespaces: { [p: string]: string[] } = {};

    const twigPaths: string[] = Object.keys(symfonyConfig.twig_config.paths).map((key) => {
        if (key.startsWith(symfonyOptions.projectDir)) {
            return `${key}/`;
        }

        return `${symfonyOptions.projectDir}/${key}/`;
    });

    if (twigPaths.length === 0) {
        twigPaths.push(`${symfonyOptions.projectDir}/templates`);
    }

    for (const { name_prefix: namePrefix, template_directory: templateDirectory } of Object.values(
        symfonyConfig.twig_component_config.defaults
    )) {
        componentNamespaces[namePrefix] = twigPaths.map((twigPath) => join(twigPath, templateDirectory));
    }

    const anonymousNamespace: string[] = twigPaths.map((twigPath) =>
        join(twigPath, symfonyConfig.twig_component_config.anonymous_template_directory)
    );

    return {
        twigComponent: {
            anonymousTemplateDirectory: anonymousNamespace,
            namespaces: componentNamespaces,
        },
        twig: {
            paths: twigPaths,
        },
        additionalWatchPaths: symfonyOptions.additionalWatchPaths || [],
        projectPathAliases: symfonyOptions.projectPathAliases || {},
    } as BuildOptions;
};

export const webpack: StorybookConfig['webpack'] = async (config, options) => {
    const framework = await options.presets.apply('framework');

    const frameworkOptions = typeof framework === 'string' ? {} : framework.options;

    // This options resolution should be done right before creating the build configuration (i.e. not in options presets).
    const symfonyOptions = await getBuildOptions(frameworkOptions.symfony);

    return {
        ...config,
        plugins: [
            ...(config.plugins || []),
            ...[
                options.configType === 'PRODUCTION'
                    ? PreviewCompilerPlugin.webpack({
                          server: frameworkOptions.symfony.server,
                      })
                    : DevPreviewCompilerPlugin.webpack({
                          projectDir: frameworkOptions.symfony.projectDir,
                          server: frameworkOptions.symfony.server,
                          additionalWatchPaths: symfonyOptions.additionalWatchPaths,
                      }),
                TwigLoaderPlugin.webpack({
                    twigComponentConfiguration: symfonyOptions.twigComponent,
                    projectPathAliases: symfonyOptions.projectPathAliases,
                }),
            ],
        ],
        module: {
            ...config.module,
            rules: [...(config.module?.rules || [])],
        },
    };
};

export const previewHead: PresetProperty<'previewHead'> = async (base: any) => dedent`
    ${base}
    <!--PREVIEW_HEAD_PLACEHOLDER-->
    `;

export const previewBody: PresetProperty<'previewBody'> = async (base: any) => dedent`
    ${base}
    <!--PREVIEW_BODY_PLACEHOLDER-->
    `;

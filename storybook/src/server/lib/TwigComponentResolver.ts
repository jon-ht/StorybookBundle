import { TwigComponentConfiguration } from './symfony';
import path from 'path';
import dedent from 'ts-dedent';

export class TwigComponentResolver {
    constructor(
        private config: TwigComponentConfiguration,
        private projectPathAliases: {
            [p: string]: string;
        } = {}
    ) {}

    resolveNameFromFile(file: string) {
        const stripDirectory = (file: string, dir: string) => {
            return file.replace(dir, '').replace(/^\//, '').replaceAll('/', ':').replace('.html.twig', '');
        };

        const resolvedFile = this.resolvePathAlias(file);

        for (const [namespace, twigDirectories] of Object.entries(this.config.namespaces)) {
            const matchingDirectory = twigDirectories.find((dir) => resolvedFile.startsWith(dir));
            if (matchingDirectory) {
                const trimmedPath = stripDirectory(resolvedFile, matchingDirectory);
                return namespace ? `${namespace}:${trimmedPath}` : trimmedPath;
            }
        }

        for (const anonymousDir of this.config.anonymousTemplateDirectory) {
            if (resolvedFile.startsWith(anonymousDir)) {
                return stripDirectory(resolvedFile, anonymousDir);
            }
        }

        throw new Error(dedent`Unable to determine template name for file "${file}":`);
    }

    resolveFileFromName(name: string) {
        const nameParts = name.split(':');
        const namespace = nameParts.length > 1 ? nameParts[0] : '';
        const dirParts = nameParts.slice(0, -1);
        const filename = `${nameParts.slice(-1)}.html.twig`;

        const lookupPaths: string[] = [];

        if (namespace && this.config.namespaces[namespace]) {
            const namespacePaths = this.config.namespaces[namespace];
            if (namespacePaths.length > 0) {
                for (const namespacePath of this.config.namespaces[namespace]) {
                    lookupPaths.push(path.join(this.resolvePathAlias(namespacePath), dirParts.slice(1).join('/')));
                }
            }
        }

        if (this.config.namespaces[''] && this.config.namespaces[''].length > 0) {
            for (const namespacePath of this.config.namespaces['']) {
                lookupPaths.push(path.join(this.resolvePathAlias(namespacePath), dirParts.join('/')));
            }
        }

        if (this.config.anonymousTemplateDirectory.length > 0) {
            for (const namespacePath of this.config.anonymousTemplateDirectory) {
                lookupPaths.push(path.join(this.resolvePathAlias(namespacePath), dirParts.join('/')));
            }
        }

        try {
            return require.resolve(`./${filename}`, { paths: lookupPaths });
        } catch (err) {
            throw new Error(dedent`Unable to find template file for component "${name}": ${err}`);
        }
    }

    private resolvePathAlias(file: string) {
        for (const [alias, resolvedPath] of Object.entries(this.projectPathAliases)) {
            if (file.startsWith(alias)) {
                return file.replace(alias, resolvedPath);
            }
            if (file.startsWith(resolvedPath)) {
                return file.replace(resolvedPath, alias);
            }
        }
        return file;
    }
}

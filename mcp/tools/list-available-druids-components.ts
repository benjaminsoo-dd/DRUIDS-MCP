import type { AppMapItem } from '@docs-builder-lib/browser/app-map';

import { DRUIDS_APP_MAP_PATH, DRUIDS_DIRECTORY_PATH } from './constants';

interface AvailableComponent {
    name: string;
    description?: string;
    statusLevel?: string;
    directoryPath: string;
    importPath?: string;
}

export const listAvailableDruidsComponents = async (): Promise<
    AvailableComponent[]
> => {
    const response = await fetch(DRUIDS_APP_MAP_PATH);
    const componentMap = (await response.json()).map;

    // Filter only items that are components (have /components/ in their destination)
    return componentMap
        .filter(
            (item: AppMapItem) =>
                item.destination && item.destination.includes('/components/'),
        )
        .map((item: AppMapItem) => ({
            name: item.label,
            description: item.metadata?.description,
            statusLevel: item.metadata?.statusLevel,
            directoryPath: `${DRUIDS_DIRECTORY_PATH}${item.destination.replace(
                '/components/',
                '/',
            )}`,
            importPath: item.importPath,
        }));
};

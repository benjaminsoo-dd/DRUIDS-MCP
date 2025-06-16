import type { Prop } from '@docs-builder-lib/node/metadata';

import { DRUIDS_APP_MAP_PATH } from './constants';

/**
 * Represents a prop in a simplified, AI-friendly format.
 */
interface AIFriendlyProp {
    name: string;
    type: string;
    required?: boolean;
    defaultValue?: unknown;
    description?: string;
    possibleValues?: string[];
}

/**
 * Represents the props of a component in a format consumable for AI agents.
 */
interface AIFriendlyComponentProps {
    name: string;
    props?: AIFriendlyProp[];
    notFound?: boolean;
}

/**
 * Maps a raw Prop object to an AIFriendlyProp, omitting undefined fields.
 */
function mapPropToAIFriendly(prop: Prop): AIFriendlyProp {
    const aiProp: AIFriendlyProp = {
        name: prop.name,
        type: prop.type,
    };
    if (prop.required !== undefined) {
        aiProp.required = prop.required;
    }
    if (prop.defaultValue !== undefined) {
        aiProp.defaultValue = prop.defaultValue;
    }
    if (prop.description) {
        aiProp.description = prop.description;
    }
    if (prop.possibleValues) {
        aiProp.possibleValues = prop.possibleValues;
    }
    return aiProp;
}

/**
 * Given a list of DRUIDS component names, fetches their prop definitions from the app map
 * and returns them in a format that is easy for AI agents to consume.
 *
 * @param names - List of component names to retrieve props for
 * @returns Array of objects, each containing the component name and its props (or notFound if missing)
 */
export const getDruidsComponentProps = async (
    names: string[],
): Promise<AIFriendlyComponentProps[]> => {
    if (!names || names.length === 0) {
        return [];
    }

    // Fetch the DRUIDS app map
    const response = await fetch(DRUIDS_APP_MAP_PATH);
    const appMap = await response.json();
    const componentMap = appMap.map;

    // Build a lookup for fast access
    const nameSet = new Set(names);
    const found: Record<string, Prop[] | undefined> = {};
    for (const item of componentMap) {
        if (nameSet.has(item.label)) {
            found[item.label] = item.props;
        }
    }

    // Format the result for each requested name
    return names.map((name) => {
        const props = found[name];
        if (!props) {
            return { name, notFound: true };
        }
        return {
            name,
            props: props.map(mapPropToAIFriendly),
        };
    });
};

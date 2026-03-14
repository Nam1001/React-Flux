/**
 * No-op extension for validating the registry pattern.
 * @internal
 */
import { registerExtension } from '../registry';

registerExtension({
    key: '__noop',
    processDefinition: (definition) => ({
        state: { ...definition },
    }),
});

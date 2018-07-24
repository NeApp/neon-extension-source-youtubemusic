/* eslint-disable key-spacing */
/* globals cloneInto */
import Browser from 'wes/core/environment';
import Find from 'lodash-es/find';
import ForEach from 'lodash-es/forEach';
import Get from 'lodash-es/get';
import IsUndefined from 'lodash-es/isUndefined';
import IsNil from 'lodash-es/isNil';
import IsString from 'lodash-es/isString';
import Map from 'lodash-es/map';
import Set from 'lodash-es/set';

import Log from '../Core/Logger';


export const EntityTypes = {
    AlbumRelease: 'albumRelease',
    AlbumReleaseDetail: 'albumReleaseDetail',
    AlbumReleaseUserDetail: 'albumReleaseUserDetail',

    Artist: 'artist',

    Track: 'track',
    TrackUserDetail: 'trackUserDetail'
};

export const EntityStructure = {
    [EntityTypes.AlbumRelease]: {
        [EntityTypes.AlbumRelease]:             null,
        [EntityTypes.AlbumReleaseDetail]:       'details',
        [EntityTypes.AlbumReleaseUserDetail]:   'userDetails',

        [EntityTypes.Artist]:                   'primaryArtists',

        [EntityTypes.Track]:                    'details.tracks',

        [EntityTypes.TrackUserDetail]:          {
            parent: 'details.tracks',
            path: 'userDetails',

            match: (data, item) => (
                data.parentTrack === item.id
            )
        }
    }
};

export class EntityParser {
    parse(type, payloads) {
        if(IsNil(payloads) || payloads.length < 1) {
            return null;
        }

        // Find item structure
        let structure = EntityStructure[type];

        if(IsNil(structure)) {
            throw new Error(`Unsupported type: "${type}"`);
        }

        // Parse entity
        let item = null;

        ForEach(payloads, (payload) => {
            let target = item;

            // Parse payload
            let { parent, path, match, data } = this._parsePayload(structure, payload);

            if(IsUndefined(path)) {
                Log.warn('Ignoring unsupported payload:', payload);
                return;
            }

            // Process item
            if(IsNil(path)) {
                if(!IsNil(item)) {
                    throw new Error('Item already parsed');
                }

                // Update item
                item = data;
                return;
            }

            // Find parent
            if(!IsNil(parent)) {
                target = Get(target, parent);

                if(IsNil(target)) {
                    throw new Error(`Unable to find parent: ${parent}`);
                }
            }

            // Find match
            if(!IsNil(match)) {
                if(!Array.isArray(target)) {
                    throw new Error('Unable to find match, expected an array');
                }

                // Find match
                target = Find(target, (item) => match(data, item));

                if(IsNil(target)) {
                    throw new Error('Unable to find match');
                }
            }

            // Retrieve identifier from path
            let current = Get(target, path);

            if(IsNil(current)) {
                Log.warn(`No identifier found at "${path}", ignoring payload:`, payload);
                return;
            }

            // Process child
            let value = data;

            if(Array.isArray(current)) {
                value = Map(current, (id) => {
                    if(data.id === id) {
                        return data;
                    }

                    return id;
                });
            } else if(data.id !== current) {
                throw new Error(`Invalid item (expected "${current}", found "${data.id}")`);
            }

            // Update value
            Set(target, path, this._cloneIntoContext(value, target));
        });

        return item;
    }

    // TODO Move to framework
    _cloneIntoContext(value, parent) {
        if(Browser.name === 'firefox') {
            return cloneInto(value, parent);
        }

        return value;
    }

    _parsePayload(structure, payload) {
        let keys = Object.keys(payload);

        if(keys.length < 1) {
            throw new Error('Invalid payload');
        }

        let result = structure[keys[0]];

        if(IsString(result)) {
            result = { path: result };
        }

        return {
            parent: null,
            path: null,
            match: null,

            ...result,

            data: payload[keys[0]]
        };
    }
}

export default new EntityParser();

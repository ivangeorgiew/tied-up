import { isDevelopment } from './options'
import { createFunc } from './utils/createFunc'
import { logError } from './utils/logging'

export const tieUp = createFunc({
    descr: 'tying up data',
    argTypes: `{
        :descr: str,
        :argTypes: str | undef,
        :onError: () | undef,
        :useCache: () | undef,
        :data: any
    }`,
    onError: ({ args: [props] }) => props?.data,
    func: function (props) {
        if (
            props.data === null ||
            (typeof props.data !== 'object' && typeof props.data !== 'function')
        ) {
            return props.data
        }

        const refs = new WeakMap()
        const stack = [{ props }]
        let [result, isFirstCall] = [undefined, true]

        while (stack.length) {
            const { props, target, targetKey, targetDescriptor } = stack.pop()
            const { descr, data } = props

            if (refs.has(data)) {
                Object.defineProperty(
                    target,
                    targetKey,
                    Object.assign(targetDescriptor, {
                        value: refs.get(data)
                    })
                )
                continue
            }

            let handledData

            if (typeof data === 'function') {
                handledData = createFunc({
                    descr,
                    argTypes: props.argTypes,
                    useCache: props.useCache,
                    onError: props.onError,
                    func: data
                })
            } else if (data instanceof RegExp) {
                const regExpText = String(data)
                const lastSlashIdx = regExpText.lastIndexOf('/')

                handledData = new RegExp(
                    regExpText.slice(1, lastSlashIdx),
                    regExpText.slice(lastSlashIdx + 1)
                )
            } else if (data instanceof Date) {
                handledData = new Date(data.getTime())
            } else if (Array.isArray(data)) {
                handledData = []
            } else {
                handledData = {}
            }

            refs.set(data, handledData)
            Object.setPrototypeOf(handledData, Object.getPrototypeOf(data))

            const descriptors = Object.getOwnPropertyDescriptors(data)
            const descriptorKeys = Object.getOwnPropertyNames(descriptors).concat(
                Object.getOwnPropertySymbols(descriptors)
            )

            for (let i = 0; i < descriptorKeys.length; i++) {
                // key can be a Symbol
                const key = String(descriptorKeys[i])

                try {
                    const value = descriptors[key].value

                    if (!('value' in descriptors[key])) {
                        Object.defineProperty(handledData, key, descriptors[key])
                        continue
                    }

                    if (
                        value !== null &&
                        (typeof value === 'object' || typeof value === 'function') &&
                        !/.(OnError|UseCache)$/.test(key)
                    ) {
                        stack.push({
                            target: handledData,
                            targetKey: key,
                            targetDescriptor: descriptors[key],
                            props: {
                                descr: `${descr}["${key}"]`,
                                argTypes: data[`${key}ArgTypes`],
                                useCache: data[`${key}UseCache`],
                                onError: data[`${key}OnError`],
                                data: value
                            }
                        })
                        continue
                    }

                    Object.defineProperty(
                        handledData,
                        key,
                        Object.assign(descriptors[key], { value })
                    )
                } catch (error) {
                    logError({
                        descr: `assigning method ${key} to ${descr}`,
                        error,
                        args: [data, handledData]
                    })
                }
            }

            if (
                isDevelopment &&
                typeof handledData === 'function' &&
                typeof handledData.name === 'string'
            ) {
                Object.defineProperty(handledData, 'name', {
                    value: `[${descr}]`,
                    configurable: true
                })
            }

            if (isFirstCall) {
                result = handledData
                isFirstCall = false
            } else {
                Object.defineProperty(
                    target,
                    targetKey,
                    Object.assign(targetDescriptor, { value: handledData })
                )
            }
        }

        return result
    }
})

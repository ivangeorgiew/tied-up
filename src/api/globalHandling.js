import { createFunc } from "../utils/createFunc"
import { logError } from "../utils/logging"
import { browserErrorEvents, isServer, isWeb, nodeErrorEvents } from "./constants"
import { boolDef } from "./validating"

const uncaughtErrorListenerSpec = []

const uncaughtErrorListener = createFunc(
    "listening for uncaught errors",
    uncaughtErrorListenerSpec,
    () => {},
    eventOrError => {
        const descr = "unhandled error"
        const unknownMsg = "Unknown error"

        if (isWeb) {
            const isEvent = eventOrError instanceof Event
            const error = !isEvent
                ? Error(unknownMsg)
                : eventOrError.reason instanceof Error
                ? eventOrError.reason
                : eventOrError.error instanceof Error
                ? eventOrError.error
                : Error(unknownMsg)

            if (isEvent) {
                eventOrError.stopImmediatePropagation()
                eventOrError.preventDefault()
            }

            logError({ descr, args: [], error })
        } else if (isServer) {
            const isError = eventOrError instanceof Error
            const exitCode = isError ? 1 : 0

            if (isError) {
                logError({ descr, args: [], error: eventOrError })
            }

            setTimeout(() => {
                process.exit(exitCode)
            }, 500).unref()
        }
    }
)

const globalHandleErrorsSpec = [boolDef]

export const globalHandleErrors = createFunc(
    "handling listeners for uncaught errors",
    globalHandleErrorsSpec,
    () => {},
    shouldAdd => {
        if (isWeb) {
            browserErrorEvents.forEach(event => {
                self.removeEventListener(event, uncaughtErrorListener, true)

                if (shouldAdd) {
                    self.addEventListener(event, uncaughtErrorListener, true)
                }
            })
        } else if (isServer) {
            nodeErrorEvents.forEach(event => {
                process.removeListener(event, uncaughtErrorListener)

                if (shouldAdd) {
                    process.on(event, uncaughtErrorListener)
                }
            })
        }
    }
)

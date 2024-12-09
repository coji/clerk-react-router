import { constants, debugRequestState } from '@clerk/backend/internal'
import { isTruthy } from '@clerk/shared/underscore'
import cookie from 'cookie'
import type { AppLoadContext } from 'react-router'
import { data } from 'react-router'

import { getEnvVariable } from '../utils/utils'
import type { RequestStateWithRedirectUrls } from './types'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === 'number' &&
    typeof value.statusText === 'string' &&
    typeof value.headers === 'object' &&
    typeof value.body !== 'undefined'
  )
}

export function isRedirect(res: Response): boolean {
  return res.status >= 300 && res.status < 400
}

export const parseCookies = (req: Request) => {
  return cookie.parse(req.headers.get('cookie') || '')
}

export function assertValidHandlerResult(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  val: any,
  error?: string,
): asserts val is Record<string, unknown> | null {
  if ((val !== null && typeof val !== 'object') || Array.isArray(val)) {
    throw new Error(error || '')
  }
}

export const injectRequestStateIntoResponse = async (
  response: Response,
  requestState: RequestStateWithRedirectUrls,
  context: AppLoadContext,
) => {
  const clone = new Response(response.body, response)
  const json = await clone.json()

  const { clerkState, headers } = getResponseClerkState(requestState, context)

  // set the correct content-type header in case the user returned a `Response` directly
  // without setting the header, instead of using the `json()` helper
  clone.headers.set(constants.Headers.ContentType, constants.ContentTypes.Json)
  headers.forEach((value, key) => {
    clone.headers.append(key, value)
  })

  return data({ ...(json || {}), ...clerkState }, clone)
}

export function injectRequestStateIntoDeferredData(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  responseData: any,
  requestState: RequestStateWithRedirectUrls,
  context: AppLoadContext,
) {
  const { clerkState, headers } = getResponseClerkState(requestState, context)

  // Avoid creating a new object here to retain referential equality.

  responseData.data.clerkState = clerkState.clerkState

  if (typeof responseData.init !== 'undefined') {
    responseData.init.headers = new Headers(responseData.init.headers)

    headers.forEach((value, key) => {
      responseData.init.headers.append(key, value)
    })
  }

  return responseData
}

/**
 * Returns the clerk state object and observability headers to be injected into a loader response.
 *
 * @internal
 */
export function getResponseClerkState(
  requestState: RequestStateWithRedirectUrls,
  context: AppLoadContext,
) {
  const { reason, message, isSignedIn, ...rest } = requestState
  const clerkState = wrapWithClerkState({
    __clerk_ssr_state: rest.toAuth(),
    __publishableKey: requestState.publishableKey,
    __proxyUrl: requestState.proxyUrl,
    __domain: requestState.domain,
    __isSatellite: requestState.isSatellite,
    __signInUrl: requestState.signInUrl,
    __signUpUrl: requestState.signUpUrl,
    __afterSignInUrl: requestState.afterSignInUrl,
    __afterSignUpUrl: requestState.afterSignUpUrl,
    __signInForceRedirectUrl: requestState.signInForceRedirectUrl,
    __signUpForceRedirectUrl: requestState.signUpForceRedirectUrl,
    __signInFallbackRedirectUrl: requestState.signInFallbackRedirectUrl,
    __signUpFallbackRedirectUrl: requestState.signUpFallbackRedirectUrl,
    __clerk_debug: debugRequestState(requestState),
    __clerkJSUrl: getEnvVariable('CLERK_JS', context),
    __clerkJSVersion: getEnvVariable('CLERK_JS_VERSION', context),
    __telemetryDisabled: isTruthy(
      getEnvVariable('CLERK_TELEMETRY_DISABLED', context),
    ),
    __telemetryDebug: isTruthy(
      getEnvVariable('CLERK_TELEMETRY_DEBUG', context),
    ),
  })

  return {
    clerkState,
    headers: requestState.headers,
  }
}

/**
 * Wraps obscured clerk internals with a readable `clerkState` key.
 * This is intended to be passed by the user into <ClerkProvider>
 *
 * @internal
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const wrapWithClerkState = (data: any) => {
  return { clerkState: { __internal_clerk_state: { ...data } } }
}

/**
 * Patches request to avoid duplex issues with unidici
 * For more information, see:
 * https://github.com/nodejs/node/issues/46221
 * https://github.com/whatwg/fetch/pull/1457
 * @internal
 */
export const patchRequest = (request: Request) => {
  const clonedRequest = new Request(request.url, {
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    cache: request.cache,
    signal: request.signal,
  })

  // If duplex is not set, set it to 'half' to avoid duplex issues with unidici
  if (
    clonedRequest.method !== 'GET' &&
    clonedRequest.body !== null &&
    !('duplex' in clonedRequest)
  ) {
    ;(clonedRequest as unknown as { duplex: 'half' }).duplex = 'half'
  }

  return clonedRequest
}
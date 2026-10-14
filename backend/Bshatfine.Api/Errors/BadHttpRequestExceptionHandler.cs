using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Bshatfine.Api.Errors;

public class BadHttpRequestExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException badRequest)
            return false;

        httpContext.Response.StatusCode = badRequest.StatusCode;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = badRequest.StatusCode,
                Title = "The request could not be processed.",
                Detail = badRequest.StatusCode == StatusCodes.Status413PayloadTooLarge
                    ? "The upload is too large. The maximum is 10 MB."
                    : badRequest.Message
            }
        });
    }
}
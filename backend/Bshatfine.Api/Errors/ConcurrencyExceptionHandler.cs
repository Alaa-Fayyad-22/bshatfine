using Bshatfine.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Bshatfine.Api.Errors;

public class ConcurrencyExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        if (exception is not ConcurrencyConflictException conflict)
            return false;

        http.Response.StatusCode = StatusCodes.Status409Conflict;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The item was changed by someone else.",
                Detail = conflict.Message
            }
        });
    }
}
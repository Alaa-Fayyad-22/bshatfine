using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Bshatfine.Api.Errors;

/// <summary>
/// Turns PostgreSQL errors caused by the request's own data into 400 instead of 500,
/// e.g. a NUL character (\u0000) in a text field or search, or a duplicate unique value.
/// </summary>
public class DatabaseExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        // Thrown directly by queries, or wrapped in DbUpdateException by SaveChanges
        var postgres = FindPostgresException(exception);
        if (postgres is null)
            return false;

        var detail = postgres.SqlState switch
        {
            PostgresErrorCodes.CharacterNotInRepertoire or PostgresErrorCodes.UntranslatableCharacter
                => "The text contains a character that is not allowed.",
            PostgresErrorCodes.StringDataRightTruncation
                => "A text value is too long.",
            PostgresErrorCodes.UniqueViolation
                => "This item already exists.",
            _ => null
        };

        if (detail is null)
            return false; // a real server problem: let it stay a 500

        http.Response.StatusCode = StatusCodes.Status400BadRequest;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "The request contains invalid data.",
                Detail = detail
            }
        });
    }

    private static PostgresException? FindPostgresException(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres)
                return postgres;
        }
        return null;
    }
}
using Bshatfine.Api.Endpoints;
using Bshatfine.Api.Endpoints.Admin;
using Bshatfine.Api.Errors;
using Bshatfine.Application;
using Bshatfine.Infrastructure;
using Bshatfine.Infrastructure.Identity;
using Bshatfine.Api.Security;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";

// ---------- Configuration ----------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' not found.");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

// ---------- Services ----------
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddApplication();
builder.WebHost.ConfigureKestrel(options =>
   options.Limits.MaxRequestBodySize = 11 * 1024 * 1024); // 11 MB: the largest upload + form overhead
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddExceptionHandler<BadHttpRequestExceptionHandler>();
builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));
builder.Services.AddBshatfineAuthentication();

builder.Services.AddOpenApi();



// ---------- Pipeline ----------
var app = builder.Build();
await IdentitySeeder.SeedAsync(app.Services, app.Configuration);

app.UseExceptionHandler();
app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// ---------- Endpoints ----------
app.MapNewsEndpoints();
app.MapAdminNewsEndpoints();
app.MapFileEndpoints();
app.MapAuthEndpoints();

app.Run();
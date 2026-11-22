using Bshatfine.Api.Endpoints;
using Bshatfine.Api.Endpoints.Admin;
using Bshatfine.Api.Errors;
using Bshatfine.Api.Security;
using Bshatfine.Application;
using Bshatfine.Application.Security;
using Bshatfine.Infrastructure;
using Bshatfine.Infrastructure.Identity;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";

// ---------- Configuration ----------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' not found.");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 11 * 1024 * 1024; // 11 MB: the largest upload + form overhead
    options.AddServerHeader = false;                      // don't advertise what we run
});

// ---------- Services ----------
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddApplication();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddExceptionHandler<BadHttpRequestExceptionHandler>();

builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("Retry-After")));



builder.Services.AddBshatfineAuthentication();
builder.Services.AddBshatfineRateLimiting(builder.Configuration);
builder.Services.AddOpenApi();
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});
builder.Services.AddExceptionHandler<ConcurrencyExceptionHandler>();
builder.Services.AddExceptionHandler<DatabaseExceptionHandler>();

// ---------- Pipeline ----------
var app = builder.Build();
await IdentitySeeder.SeedAsync(app.Services, app.Configuration);

app.UseForwardedHeaders();
app.UseBshatfineSecurityHeaders();
app.UseBshatfineTrustedProxy(app.Configuration);
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors(FrontendCorsPolicy);
app.UseBshatfineOriginCheck(allowedOrigins);
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// ---------- Endpoints ----------
// Public
app.MapNewsEndpoints();
app.MapFileEndpoints();
app.MapAuthEndpoints();
app.MapEntryEndpoints();
app.MapSiteSettingsEndpoints();
app.MapCouncilEndpoints();

// Staff only: everything under /api/admin inherits this protection
var admin = app.MapGroup("/api/admin")
    .RequireAuthorization(Policies.Staff)
    .RequireRateLimiting(RateLimitPolicies.Admin);

admin.MapAdminUserEndpoints();
admin.MapAdminNewsEndpoints();
admin.MapAdminSiteSettingsEndpoints();
admin.MapAdminAuditEndpoints();
admin.MapAdminCouncilEndpoints();
admin.MapAdminEntryEndpoints();

app.Run();
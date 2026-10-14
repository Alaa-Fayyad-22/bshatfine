using Bshatfine.Api.Endpoints;
using Bshatfine.Api.Endpoints.Admin;
using Bshatfine.Api.Errors;
using Bshatfine.Application;
using Bshatfine.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";

// ---------- Configuration ----------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' not found.");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

// ---------- Services ----------
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddApplication();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();

builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

builder.Services.AddOpenApi();

// ---------- Pipeline ----------
var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(FrontendCorsPolicy);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// ---------- Endpoints ----------
app.MapNewsEndpoints();
app.MapAdminNewsEndpoints();
app.MapFileEndpoints();

app.Run();
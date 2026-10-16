using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Common;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class NewsRepository(AppDbContext db) : INewsRepository
{
    public async Task<(List<NewsSummaryRow> Items, int TotalCount)> GetPublishedSummariesAsync(
    Language language, int page, int pageSize, CancellationToken ct)
    {
        var query = db.News.Where(n => n.Status == NewsStatus.Published);

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(n => n.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id,
                n.Slug,
                n.PublishedAt,
                n.CoverImagePath,
                // The requested language if it exists, otherwise the other one
                Translation = n.Translations
                    .OrderBy(t => t.Language == language ? 0 : 1)
                    .ThenBy(t => t.Language)
                    .Select(t => new
                    {
                        t.Language,
                        t.Title,
                        // One extra character tells us whether the body was cut
                        BodyStart = t.Body.Substring(0, NewsSummaryRow.ExcerptLength + 1)
                    })
                    .First()
            })
            .ToListAsync(ct);

        var items = rows
            .Select(r => new NewsSummaryRow(
                r.Id, r.Slug, r.Translation.Language, r.Translation.Title,
                r.Translation.BodyStart, r.PublishedAt, r.CoverImagePath))
            .ToList();

        return (items, total);
    }

    public async Task<(List<News> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, NewsStatus? status, CancellationToken ct)
    {
        var query = db.News.AsQueryable();

        // Filter BEFORE counting and paging, so totals and pages match the filter
        if (status is { } s)
            query = query.Where(n => n.Status == s);

        var total = await query.CountAsync(ct);

        var items = await query
            .Include(n => n.Translations)
            .AsNoTracking()
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<News?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.News
            .Include(n => n.Translations)
            .FirstOrDefaultAsync(n => n.Id == id, ct);

    public Task<News?> GetPublishedByIdAsync(Guid id, CancellationToken ct) =>
        db.News
            .Include(n => n.Translations)
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id && n.Status == NewsStatus.Published, ct);

    public Task<News?> GetPublishedBySlugAsync(string slug, CancellationToken ct) =>
        db.News
            .Include(n => n.Translations)
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Slug == slug && n.Status == NewsStatus.Published, ct);

    public void Add(News news) => db.News.Add(news);

    public void SetExpectedVersion(News news, uint version) =>
    db.Entry(news).Property(n => n.Version).OriginalValue = version;

    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(
                "This article was changed by someone else. Reload it to see the latest version, then apply your changes again.");
        }
    }
    public void Remove(News news) => db.News.Remove(news);
}
using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class NewsRepository(AppDbContext db) : INewsRepository
{
    public async Task<(List<News> Items, int TotalCount)> GetPublishedAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.News.Where(n => n.Status == NewsStatus.Published);

        var total = await query.CountAsync(ct);

        var items = await query
            .Include(n => n.Translations)
            .AsNoTracking()
            .OrderByDescending(n => n.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

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

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
    public void Remove(News news) => db.News.Remove(news);
}
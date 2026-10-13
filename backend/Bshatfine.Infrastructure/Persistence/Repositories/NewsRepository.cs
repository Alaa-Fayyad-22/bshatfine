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

    public async Task<(List<News> Items, int TotalCount)> GetAllAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.News.AsQueryable();

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

    public void Add(News news) => db.News.Add(news);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
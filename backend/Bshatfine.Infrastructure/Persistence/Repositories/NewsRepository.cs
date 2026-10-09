using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class NewsRepository(AppDbContext db) : INewsRepository
{
    public Task<List<News>> GetLatestAsync(int page, int pageSize, CancellationToken ct) =>
        db.News
            .AsNoTracking()
            .OrderByDescending(n => n.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task AddAsync(News news, CancellationToken ct)
    {
        db.News.Add(news);
        await db.SaveChangesAsync(ct);
    }
}